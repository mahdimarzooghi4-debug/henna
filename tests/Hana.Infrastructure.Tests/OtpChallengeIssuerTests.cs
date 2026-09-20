using Hana.Application.Time;
using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Tests;

public sealed class OtpChallengeIssuerTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);

    private static DbContextOptions<HanaIdentityDbContext>? DbOptions()
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        return string.IsNullOrWhiteSpace(cs) ? null :
            new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(cs).Options;
    }

    private static IranianMobileNumber NewPhone()
    {
        var raw = "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
        if (!IranianMobileNumber.TryParse(raw, out var phone))
            throw new InvalidOperationException("Test phone not valid.");
        return phone!;
    }

    [Fact]
    public async Task AcceptedSenderPersistsDigestAndReferenceWithoutPlaintext()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var clock = new TestClock(Now);
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var sender = new TestSender();

        await using var db = new HanaIdentityDbContext(options);
        var result = await new OtpChallengeIssuer(db, crypto, sender, clock)
            .IssueAsync(phone);

        Assert.Equal(OtpIssueStatus.Accepted, result.Status);
        Assert.NotNull(result.ChallengeId);
        var stored = await db.OtpChallenges.AsNoTracking()
            .SingleAsync(x => x.Id == result.ChallengeId);
        Assert.Equal(OtpDeliveryStates.Accepted, stored.DeliveryStatus);
        Assert.Equal("ci-provider-reference", stored.ProviderMessageReference);
        Assert.True(crypto.VerifyDigest(stored.Id, phone.Value, sender.SentCode,
            stored.CodeDigest));
        Assert.NotEqual(Encoding.ASCII.GetBytes(sender.SentCode!), stored.CodeDigest);
        Assert.Equal(Now.Add(OtpChallengeIssuer.Lifetime), stored.ExpiresAtUtc);
        Assert.Equal(1, sender.CallCount);
    }

    [Fact]
    public async Task ResendCooldownIsPersistedAcrossSeparateDbContexts()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var sender = new TestSender();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);

        await using (var db = new HanaIdentityDbContext(options))
            Assert.Equal(OtpIssueStatus.Accepted,
                (await new OtpChallengeIssuer(db, crypto, sender, clock)
                    .IssueAsync(phone)).Status);

        await using (var db = new HanaIdentityDbContext(options))
            Assert.Equal(OtpIssueStatus.Cooldown,
                (await new OtpChallengeIssuer(db, crypto, sender, clock)
                    .IssueAsync(phone)).Status);

        Assert.Equal(1, sender.CallCount);
    }

    [Fact]
    public async Task RejectedDeliveryCannotBecomeVerifiable()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var sender = new TestSender { Mode = SendMode.Reject };
        await using var db = new HanaIdentityDbContext(options);

        var result = await new OtpChallengeIssuer(db, crypto, sender,
            new TestClock(Now)).IssueAsync(phone);
        Assert.Equal(OtpIssueStatus.Unavailable, result.Status);
        Assert.Null(result.ChallengeId);

        var record = await db.OtpChallenges.AsNoTracking()
            .SingleAsync(x => x.NormalizedPhone == phone.Value);
        Assert.Equal(OtpDeliveryStates.Failed, record.DeliveryStatus);
        Assert.Null(record.ProviderMessageReference);

        await using var verificationDb = new HanaIdentityDbContext(options);
        var verifier = new OtpChallengeVerifier(verificationDb, crypto,
            new TestClock(Now.AddSeconds(1)));
        Assert.Equal(OtpVerificationResult.Invalid,
            await verifier.VerifyAsync(record.Id, phone, sender.SentCode));
    }

    [Fact]
    public async Task UnknownDeliveryLeavesNonVerifiablePendingAndCooldown()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var sender = new TestSender { Mode = SendMode.Throw };
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);
        await using var db = new HanaIdentityDbContext(options);
        Assert.Equal(OtpIssueStatus.Unavailable,
            (await new OtpChallengeIssuer(db, crypto, sender, clock)
                .IssueAsync(phone)).Status);

        var record = await db.OtpChallenges.AsNoTracking()
            .SingleAsync(x => x.NormalizedPhone == phone.Value);
        Assert.Equal(OtpDeliveryStates.Pending, record.DeliveryStatus);
        Assert.Null(record.ProviderMessageReference);
        Assert.Equal(OtpIssueStatus.Cooldown,
            (await new OtpChallengeIssuer(db, crypto, sender, clock)
                .IssueAsync(phone)).Status);
        Assert.Equal(1, sender.CallCount);
    }

    [Fact]
    public async Task NewRequestAfterCooldownInvalidatesEarlierCode()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var sender = new TestSender();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);

        Guid firstId;
        await using (var db = new HanaIdentityDbContext(options))
            firstId = (await new OtpChallengeIssuer(db, crypto, sender, clock)
                .IssueAsync(phone)).ChallengeId!.Value;
        var firstCode = sender.SentCode!;
        clock.UtcNow = Now.Add(OtpChallengeIssuer.ResendCooldown);
        await using (var db = new HanaIdentityDbContext(options))
            Assert.Equal(OtpIssueStatus.Accepted,
                (await new OtpChallengeIssuer(db, crypto, sender, clock)
                    .IssueAsync(phone)).Status);

        await using var verificationDb = new HanaIdentityDbContext(options);
        var verifier = new OtpChallengeVerifier(verificationDb, crypto, clock);
        Assert.Equal(OtpVerificationResult.Invalid,
            await verifier.VerifyAsync(firstId, phone, firstCode));
        Assert.Equal(2, sender.CallCount);
    }

    [Fact]
    public async Task ConcurrentRequestsOnlyCallSenderOnce()
    {
        var options = DbOptions();
        if (options is null) return;
        var phone = NewPhone();
        var sender = new TestSender();
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var clock = new TestClock(Now);

        async Task<OtpIssueStatus> Issue()
        {
            await using var db = new HanaIdentityDbContext(options);
            return (await new OtpChallengeIssuer(db, crypto, sender, clock)
                .IssueAsync(phone)).Status;
        }

        var outcomes = await Task.WhenAll(Issue(), Issue());
        Assert.Single(outcomes, x => x == OtpIssueStatus.Accepted);
        Assert.Single(outcomes, x => x == OtpIssueStatus.Cooldown);
        Assert.Equal(1, sender.CallCount);
    }

    private enum SendMode { Accept, Reject, Throw }

    // TEST-ONLY sender: it is never registered by the shipping API.
    private sealed class TestSender : IOtpSmsSender
    {
        private int _calls;
        public bool IsAvailable => true;
        public SendMode Mode { get; set; }
        public string? SentCode { get; private set; }
        public int CallCount => _calls;

        public Task<OtpSmsDeliveryResult> SendAsync(
            string normalizedMobile, string plaintextCode,
            CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            SentCode = plaintextCode;
            if (Mode == SendMode.Throw)
                throw new IOException("Simulated provider timeout.");

            return Task.FromResult(Mode == SendMode.Reject
                ? new OtpSmsDeliveryResult(false, null)
                : new OtpSmsDeliveryResult(true, "ci-provider-reference"));
        }
    }

    private sealed class TestClock(DateTimeOffset value) : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = value;
    }
}
