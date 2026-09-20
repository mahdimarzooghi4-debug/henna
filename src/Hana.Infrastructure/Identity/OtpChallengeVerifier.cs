using Hana.Application.Time;
using Hana.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Internal OTP verification primitive; not a public sign-in endpoint.
///
/// The row lock serializes racing guesses and consumption across API replicas.
/// A Verified result MUST NOT be treated as a session token, account approval
/// or credit eligibility; the future identity workflow owns those decisions.
/// </summary>
public sealed class OtpChallengeVerifier(
    HanaIdentityDbContext db,
    OtpCodeCryptography crypto,
    IClock clock)
{
    public const int MaxFailedAttempts = 5;

    public async Task<OtpVerificationResult> VerifyAsync(
        Guid challengeId,
        IranianMobileNumber phone,
        string? candidate,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(phone);
        if (challengeId == Guid.Empty)
            return OtpVerificationResult.Invalid;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var challenge = await db.OtpChallenges
            .FromSqlInterpolated($"""
                SELECT * FROM identity.otp_challenges
                WHERE id = {challengeId} AND normalized_phone = {phone.Value}
                FOR UPDATE
                """)
            .SingleOrDefaultAsync(cancellationToken);

        var now = clock.UtcNow.ToUniversalTime();
        if (challenge is null ||
            challenge.ConsumedAtUtc.HasValue ||
            now < challenge.IssuedAtUtc ||
            now >= challenge.ExpiresAtUtc ||
            challenge.FailedAttemptCount >= MaxFailedAttempts)
            return OtpVerificationResult.Invalid;

        if (!crypto.VerifyDigest(
            challenge.Id, challenge.NormalizedPhone, candidate, challenge.CodeDigest))
        {
            challenge.FailedAttemptCount++;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return OtpVerificationResult.Invalid;
        }

        challenge.ConsumedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return OtpVerificationResult.Verified;
    }
}

public enum OtpVerificationResult
{
    Invalid,
    Verified
}
