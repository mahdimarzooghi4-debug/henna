using Hana.Application.Time;
using Hana.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Internal provider-independent OTP issuance. No sender is configured by
/// default. Persist a PENDING digest before calling an external provider, then
/// mark ACCEPTED only after an explicit provider acknowledgment.
///
/// A provider timeout leaves PENDING (unknown outcome) to avoid blind retries.
/// A later durable outbox/reconciliation mechanism is required before rollout.
/// </summary>
public sealed class OtpChallengeIssuer(
    HanaIdentityDbContext db,
    OtpCodeCryptography crypto,
    IOtpSmsSender sender,
    IClock clock)
{
    // Engineering defaults pending final security review.
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(90);

    public async Task<OtpIssueResult> IssueAsync(
        IranianMobileNumber phone,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(phone);
        if (!sender.IsAvailable)
            return new OtpIssueResult(OtpIssueStatus.Unavailable);

        var now = clock.UtcNow.ToUniversalTime();
        var id = Guid.NewGuid();
        var code = OtpCodeCryptography.GenerateCode();
        var challenge = new OtpChallengeRecord
        {
            Id = id,
            NormalizedPhone = phone.Value,
            CodeDigest = crypto.ComputeDigest(id, phone.Value, code),
            IssuedAtUtc = now,
            ExpiresAtUtc = now.Add(Lifetime),
            FailedAttemptCount = 0,
            DeliveryStatus = OtpDeliveryStates.Pending
        };

        // Cross-replica per-phone lock while reserving a new request. A hash
        // collision only causes over-serialization, never duplicate issuance.
        var hashedPhone = SHA256.HashData(Encoding.UTF8.GetBytes(phone.Value));
        var lockKey = BitConverter.ToInt64(hashedPhone, 0);
        await using (var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken))
        {
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({lockKey})", cancellationToken);

            var lastActive = await db.OtpChallenges.AsNoTracking()
                .Where(x => x.NormalizedPhone == phone.Value &&
                    x.IssuedAtUtc > now - ResendCooldown &&
                    (x.DeliveryStatus == OtpDeliveryStates.Pending ||
                     x.DeliveryStatus == OtpDeliveryStates.Accepted))
                .AnyAsync(cancellationToken);
            if (lastActive)
                return new OtpIssueResult(OtpIssueStatus.Cooldown);

            // Invalidate old challenges before issuing another, including
            // PENDING sends whose eventual outcome might still be unknown.
            await db.OtpChallenges
                .Where(x => x.NormalizedPhone == phone.Value &&
                    x.ConsumedAtUtc == null &&
                    (x.DeliveryStatus == OtpDeliveryStates.Pending ||
                     x.DeliveryStatus == OtpDeliveryStates.Accepted))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(x => x.ConsumedAtUtc,
                        (DateTimeOffset?)now), cancellationToken);

            db.OtpChallenges.Add(challenge);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        // Only the provider boundary receives plaintext. Never log or persist it.
        OtpSmsDeliveryResult delivery;
        try
        {
            delivery = await sender.SendAsync(phone.Value, code, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            // Unknown send outcome; keep PENDING so it cannot be verified and
            // a new request is not blindly sent during the cooldown.
            return new OtpIssueResult(OtpIssueStatus.Unavailable);
        }

        if (!delivery.Accepted ||
            string.IsNullOrWhiteSpace(delivery.ProviderReference) ||
            delivery.ProviderReference.Length > 160)
        {
            challenge.DeliveryStatus = OtpDeliveryStates.Failed;
            await db.SaveChangesAsync(cancellationToken);
            return new OtpIssueResult(OtpIssueStatus.Unavailable);
        }

        challenge.DeliveryStatus = OtpDeliveryStates.Accepted;
        challenge.ProviderMessageReference = delivery.ProviderReference;
        await db.SaveChangesAsync(cancellationToken);
        return new OtpIssueResult(OtpIssueStatus.Accepted, id);
    }
}

public enum OtpIssueStatus
{
    Accepted,
    Cooldown,
    Unavailable
}

public sealed record OtpIssueResult(OtpIssueStatus Status, Guid? ChallengeId = null);
