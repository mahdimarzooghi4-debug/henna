using Hana.Application.Time;
using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Cryptography;

namespace Hana.Infrastructure.Tests;

public sealed class OtpSignInTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 9, 20, 15, 0, 0, TimeSpan.Zero);
    private const string Code = "012345";

    private static DbContextOptions<HanaIdentityDbContext>? Options()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        return string.IsNullOrWhiteSpace(connection) ? null :
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options;
    }

    private static IranianMobileNumber NewPhone()
    {
        var raw = "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
        Assert.True(IranianMobileNumber.TryParse(raw, out var phone));
        return phone!;
    }

    private static async Task<Guid> SeedAcceptedAsync(
        DbContextOptions<HanaIdentityDbContext> options,
        IranianMobileNumber phone, OtpCodeCryptography crypto,
        DateTimeOffset issued, DateTimeOffset expires,
        string deliveryState = OtpDeliveryStates.Accepted)
    {
        var id = Guid.NewGuid();
        await using var db = new HanaIdentityDbContext(options);
        db.OtpChallenges.Add(new OtpChallengeRecord
        {
            Id = id,
            NormalizedPhone = phone.Value,
            CodeDigest = crypto.ComputeDigest(id, phone.Value, Code),
            IssuedAtUtc = issued,
            ExpiresAtUtc = expires,
            DeliveryStatus = deliveryState,
            ProviderMessageReference =
                deliveryState == OtpDeliveryStates.Accepted ? "ci-accepted" : null
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<SignInResult> SignInAsync(
        DbContextOptions<HanaIdentityDbContext> options,
        OtpCodeCryptography crypto, TestClock clock,
        Guid id, IranianMobileNumber phone, string code = Code)
    {
        await using var db = new HanaIdentityDbContext(options);
        return await new OtpSignInService(db, crypto, clock)
            .SignInAsync(id, phone, code);
    }

    [Fact]
    public void SessionTokenIsUnpredictableWellFormedAndNeverUsesPlaintextInDigest()
    {
        var first = SessionTokenCodec.Generate();
        var second = SessionTokenCodec.Generate();
        Assert.NotEqual(first, second);
        Assert.True(SessionTokenCodec.TryComputeDigest(first, out var digest));
        Assert.Equal(32, digest.Length);
        Assert.DoesNotContain(first, Convert.ToHexString(digest));
        Assert.False(SessionTokenCodec.TryComputeDigest(second, out var digestOther)
            && digest.SequenceEqual(digestOther));
        Assert.False(SessionTokenCodec.TryComputeDigest("a", out _));
        Assert.False(SessionTokenCodec.TryComputeDigest(null, out _));
        Assert.False(SessionTokenCodec.TryComputeDigest(first + " ", out _));
    }

    [Fact]
    public async Task AcceptedOtpCreatesOneAccountAndRevocableHashedSession()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var challengeId = await SeedAcceptedAsync(
            options, phone, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));
        var clock = new TestClock(Now);

        var result = await SignInAsync(options, crypto, clock, challengeId, phone);
        Assert.True(result.Authenticated);
        Assert.NotNull(result.BearerToken);
        Assert.NotNull(result.AccountId);
        Assert.Equal("[redacted sign-in result]", result.ToString());
        Assert.Equal(Now.AddHours(24), result.ExpiresAtUtc);

        await using var db = new HanaIdentityDbContext(options);
        var account = await db.Accounts.SingleAsync(
            x => x.NormalizedPhone == phone.Value);
        Assert.Equal(result.AccountId, account.Id);
        Assert.Equal(Now, account.PhoneVerifiedAtUtc);
        var stored = await db.AuthSessions
            .SingleAsync(x => x.AccountId == account.Id);
        Assert.NotEqual(System.Text.Encoding.UTF8.GetBytes(result.BearerToken!), stored.TokenDigest);
        Assert.True(SessionTokenCodec.TryComputeDigest(result.BearerToken, out var digest));
        Assert.Equal(digest, stored.TokenDigest);

        var sessions = new AuthSessionService(db, clock);
        Assert.Equal(account.Id,
            await sessions.ResolveAccountAsync(result.BearerToken));
        Assert.Null(await sessions.ResolveAccountAsync("bogus"));
        Assert.True(await sessions.RevokeAsync(result.BearerToken));
        Assert.False(await sessions.RevokeAsync(result.BearerToken));
        Assert.Null(await sessions.ResolveAccountAsync(result.BearerToken));
    }

    [Fact]
    public async Task WrongCodeDoesNotCreateAnAccountOrSession()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await SeedAcceptedAsync(
            options, phone, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        var denied = await SignInAsync(
            options, crypto, new TestClock(Now), id, phone, "222222");
        Assert.False(denied.Authenticated);
        Assert.Null(denied.BearerToken);

        await using var db = new HanaIdentityDbContext(options);
        Assert.False(await db.Accounts.AnyAsync(x => x.NormalizedPhone == phone.Value));
        // Other tests may have sessions for other accounts in the shared CI DB.
        Assert.Equal(1, (await db.OtpChallenges.FindAsync(id))!.FailedAttemptCount);
    }

    [Fact]
    public async Task UnknownOrUnacceptedChallengeCreatesNoAccount()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await SeedAcceptedAsync(options, phone, crypto,
            Now.AddMinutes(-1), Now.AddMinutes(4),
            OtpDeliveryStates.Pending);

        Assert.False((await SignInAsync(options, crypto,
            new TestClock(Now), id, phone)).Authenticated);
        Assert.False((await SignInAsync(options, crypto,
            new TestClock(Now), Guid.NewGuid(), phone)).Authenticated);

        await using var db = new HanaIdentityDbContext(options);
        Assert.False(await db.Accounts.AnyAsync(x => x.NormalizedPhone == phone.Value));
    }

    [Fact]
    public async Task ConcurrentSuccessConsumesCodeAndCreatesSessionExactlyOnce()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await SeedAcceptedAsync(options, phone, crypto,
            Now.AddMinutes(-1), Now.AddMinutes(4));
        var clock = new TestClock(Now);
        var outcomes = await Task.WhenAll(
            SignInAsync(options, crypto, clock, id, phone),
            SignInAsync(options, crypto, clock, id, phone));

        Assert.Single(outcomes, value => value.Authenticated);
        Assert.Single(outcomes, value => !value.Authenticated);
        await using var db = new HanaIdentityDbContext(options);
        Assert.Equal(1, await db.Accounts.CountAsync(
            x => x.NormalizedPhone == phone.Value));
        var accountId = outcomes.Single(x => x.Authenticated).AccountId!.Value;
        Assert.Equal(1, await db.AuthSessions.CountAsync(
            x => x.AccountId == accountId));
    }

    [Fact]
    public async Task SecondAcceptedOtpReusesAccountButIssuesNewSession()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);
        var firstId = await SeedAcceptedAsync(options, phone, crypto,
            Now.AddMinutes(-1), Now.AddMinutes(4));
        var first = await SignInAsync(options, crypto, clock, firstId, phone);
        Assert.True(first.Authenticated);

        clock.UtcNow = Now.AddHours(1);
        var secondId = await SeedAcceptedAsync(options, phone, crypto,
            clock.UtcNow.AddMinutes(-1), clock.UtcNow.AddMinutes(4));
        var second = await SignInAsync(options, crypto, clock, secondId, phone);
        Assert.True(second.Authenticated);
        Assert.Equal(first.AccountId, second.AccountId);
        Assert.NotEqual(first.BearerToken, second.BearerToken);

        await using var db = new HanaIdentityDbContext(options);
        Assert.Equal(1, await db.Accounts.CountAsync(
            x => x.NormalizedPhone == phone.Value));
        Assert.Equal(2, await db.AuthSessions.CountAsync(
            x => x.AccountId == first.AccountId));
    }

    [Fact]
    public async Task ExpiredSessionCannotBeResolvedOrRevoked()
    {
        var options = Options();
        if (options is null) return;

        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);
        var id = await SeedAcceptedAsync(options, phone, crypto,
            Now.AddMinutes(-1), Now.AddMinutes(4));
        var result = await SignInAsync(options, crypto, clock, id, phone);
        Assert.True(result.Authenticated);
        clock.UtcNow = Now.Add(OtpSignInService.SessionLifetime);

        await using var db = new HanaIdentityDbContext(options);
        var session = new AuthSessionService(db, clock);
        Assert.Null(await session.ResolveAccountAsync(result.BearerToken));
        Assert.False(await session.RevokeAsync(result.BearerToken));
    }

    private sealed class TestClock(DateTimeOffset utcNow) : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = utcNow;
    }
}
