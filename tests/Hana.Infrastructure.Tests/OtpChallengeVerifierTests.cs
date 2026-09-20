using Hana.Application.Time;
using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Hana.Infrastructure.Tests;

public sealed class OtpChallengeVerifierTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);
    private const string TestPhone = "09123456789";
    private const string TestCode = "012345";

    private static DbContextOptions<HanaIdentityDbContext>? DbOptions()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return null; // CI always supplies PostgreSQL; local unit-only runs may omit it.

        return new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
    }

    private static async Task<Guid> StoreAsync(
        DbContextOptions<HanaIdentityDbContext> options,
        OtpCodeCryptography crypto,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt,
        string phone = TestPhone)
    {
        var id = Guid.NewGuid();
        await using var db = new HanaIdentityDbContext(options);
        db.OtpChallenges.Add(new OtpChallengeRecord
        {
            Id = id,
            NormalizedPhone = phone,
            CodeDigest = crypto.ComputeDigest(id, phone, TestCode),
            IssuedAtUtc = issuedAt,
            ExpiresAtUtc = expiresAt,
            FailedAttemptCount = 0,
            ProviderMessageReference = "ci-test-accepted"
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<OtpVerificationResult> VerifyAsync(
        DbContextOptions<HanaIdentityDbContext> options,
        OtpCodeCryptography crypto,
        Guid id,
        string code,
        DateTimeOffset now = default,
        string phone = TestPhone)
    {
        if (!IranianMobileNumber.TryParse(phone, out var parsed))
            throw new InvalidOperationException("Test phone is invalid.");
        await using var db = new HanaIdentityDbContext(options);
        var verifier = new OtpChallengeVerifier(
            db, crypto, new FixedClock(now == default ? Now : now));
        return await verifier.VerifyAsync(id, parsed!, code);
    }

    [Fact]
    public async Task CorrectCodeIsConsumedOnlyOnce()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        Assert.Equal(OtpVerificationResult.Verified,
            await VerifyAsync(options, crypto, id, TestCode));
        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, TestCode));

        await using var db = new HanaIdentityDbContext(options);
        var challenge = await db.OtpChallenges.FindAsync(id);
        Assert.Equal(Now, challenge!.ConsumedAtUtc);
        Assert.Equal(0, challenge.FailedAttemptCount);
    }

    [Fact]
    public async Task WrongCodeAndMalformedCodeConsumeAttemptBudget()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, "111111"));
        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, "bad"));

        await using var db = new HanaIdentityDbContext(options);
        var challenge = await db.OtpChallenges.FindAsync(id);
        Assert.Equal(2, challenge!.FailedAttemptCount);
        Assert.Null(challenge.ConsumedAtUtc);
    }

    [Fact]
    public async Task AfterFiveFailuresEvenCorrectCodeIsRejected()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        for (var i = 0; i < OtpChallengeVerifier.MaxFailedAttempts; i++)
            Assert.Equal(OtpVerificationResult.Invalid,
                await VerifyAsync(options, crypto, id, "222222"));

        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, TestCode));

        await using var db = new HanaIdentityDbContext(options);
        Assert.Equal(5, (await db.OtpChallenges.FindAsync(id))!.FailedAttemptCount);
    }

    [Fact]
    public async Task InvalidPhoneAndWrongChallengeCannotBeUsed()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, TestCode, phone: "09123456788"));
        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, Guid.NewGuid(), TestCode));
        Assert.Equal(OtpVerificationResult.Verified,
            await VerifyAsync(options, crypto, id, TestCode));
    }

    [Fact]
    public async Task ExpiryAndPrematureUseAreRejected()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now, Now.AddMinutes(2));

        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, TestCode, Now.AddTicks(-1)));
        Assert.Equal(OtpVerificationResult.Invalid,
            await VerifyAsync(options, crypto, id, TestCode, Now.AddMinutes(2)));
        Assert.Equal(OtpVerificationResult.Verified,
            await VerifyAsync(options, crypto, id, TestCode, Now.AddMinutes(1)));
    }

    [Fact]
    public async Task RacingVerificationHasExactlyOneWinner()
    {
        var options = DbOptions();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var id = await StoreAsync(options, crypto, Now.AddMinutes(-1), Now.AddMinutes(4));

        var attempts = await Task.WhenAll(
            VerifyAsync(options, crypto, id, TestCode),
            VerifyAsync(options, crypto, id, TestCode));

        Assert.Single(attempts, value => value == OtpVerificationResult.Verified);
        Assert.Single(attempts, value => value == OtpVerificationResult.Invalid);
    }

    private sealed class FixedClock(DateTimeOffset utcNow) : IClock
    {
        public DateTimeOffset UtcNow => utcNow;
    }
}
