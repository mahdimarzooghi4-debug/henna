using Hana.Application.Time;
using Hana.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Internal login primitive: successful accepted OTP, account creation/reuse,
/// OTP consumption, and a hashed session are committed as ONE DB transaction.
///
/// This service is not a public endpoint until real SMS and a reviewed client
/// session transport are integrated. It never grants seller, org or credit roles.
/// </summary>
public sealed class OtpSignInService(
    HanaIdentityDbContext db,
    OtpCodeCryptography crypto,
    IClock clock)
{
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(24);

    public async Task<SignInResult> SignInAsync(
        Guid challengeId,
        IranianMobileNumber phone,
        string? candidate,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(phone);
        if (challengeId == Guid.Empty)
            return SignInResult.Denied();

        var now = clock.UtcNow.ToUniversalTime();
        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        // Acquire the SAME phone lock as the issuer BEFORE any challenge row
        // lock, preventing a deadlock against resend invalidation.
        var hashedPhone = SHA256.HashData(Encoding.UTF8.GetBytes(phone.Value));
        var lockKey = BitConverter.ToInt64(hashedPhone, 0);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({lockKey})", cancellationToken);

        var challenge = await db.OtpChallenges
            .FromSqlInterpolated($"""
                SELECT * FROM identity.otp_challenges
                WHERE id = {challengeId} AND normalized_phone = {phone.Value}
                FOR UPDATE
                """)
            .SingleOrDefaultAsync(cancellationToken);

        if (challenge is null ||
            challenge.DeliveryStatus != OtpDeliveryStates.Accepted ||
            string.IsNullOrWhiteSpace(challenge.ProviderMessageReference) ||
            challenge.ConsumedAtUtc.HasValue ||
            now < challenge.IssuedAtUtc ||
            now >= challenge.ExpiresAtUtc ||
            challenge.FailedAttemptCount >= OtpChallengeVerifier.MaxFailedAttempts)
            return SignInResult.Denied();

        if (!crypto.VerifyDigest(
            challenge.Id, challenge.NormalizedPhone, candidate, challenge.CodeDigest))
        {
            challenge.FailedAttemptCount++;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return SignInResult.Denied();
        }

        // A verified phone can identify a basic consumer account. It does NOT
        // indicate legal identity, organization membership or benefit eligibility.
        var account = await db.Accounts
            .SingleOrDefaultAsync(x => x.NormalizedPhone == phone.Value,
                cancellationToken);

        if (account is null)
        {
            account = new AccountRecord
            {
                Id = Guid.NewGuid(),
                NormalizedPhone = phone.Value,
                CreatedAtUtc = now,
                PhoneVerifiedAtUtc = now
            };
            db.Accounts.Add(account);
        }
        else if (account.PhoneVerifiedAtUtc is null)
        {
            account.PhoneVerifiedAtUtc = now;
        }

        var rawToken = SessionTokenCodec.Generate();
        if (!SessionTokenCodec.TryComputeDigest(rawToken, out var tokenDigest))
            throw new InvalidOperationException("Failed to create an opaque token.");

        db.Set<AuthSessionRecord>().Add(new AuthSessionRecord
        {
            Id = Guid.NewGuid(),
            AccountId = account.Id,
            TokenDigest = tokenDigest,
            IssuedAtUtc = now,
            ExpiresAtUtc = now.Add(SessionLifetime)
        });

        challenge.ConsumedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return SignInResult.Granted(
            account.Id, rawToken, now.Add(SessionLifetime));
    }
}

/// <summary>
/// Deliberately not a record: default record ToString would expose the token.
/// Callers must never log or serialize the whole result accidentally.
/// </summary>
public sealed class SignInResult
{
    private SignInResult(
        bool authenticated, Guid? accountId, string? bearerToken,
        DateTimeOffset? expiresAtUtc)
    {
        Authenticated = authenticated;
        AccountId = accountId;
        BearerToken = bearerToken;
        ExpiresAtUtc = expiresAtUtc;
    }

    public bool Authenticated { get; }
    public Guid? AccountId { get; }
    public string? BearerToken { get; }
    public DateTimeOffset? ExpiresAtUtc { get; }

    public static SignInResult Denied() => new(false, null, null, null);
    public static SignInResult Granted(
        Guid accountId, string bearerToken, DateTimeOffset expiresAtUtc) =>
        new(true, accountId, bearerToken, expiresAtUtc);

    public override string ToString() => "[redacted sign-in result]";
}
