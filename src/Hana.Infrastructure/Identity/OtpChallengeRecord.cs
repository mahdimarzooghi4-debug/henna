namespace Hana.Infrastructure.Identity;

/// <summary>
/// Durable OTP challenge metadata for FUTURE provider integration.
/// A digest is stored, never the plaintext one-time code.
/// No challenge should be persisted as sent until a trusted provider confirms
/// acceptance; the request endpoint currently remains fail-closed (503).
/// </summary>
public sealed class OtpChallengeRecord
{
    public Guid Id { get; set; }
    public string NormalizedPhone { get; set; } = null!;
    public byte[] CodeDigest { get; set; } = null!;
    public DateTimeOffset IssuedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public int FailedAttemptCount { get; set; }
    public DateTimeOffset? ConsumedAtUtc { get; set; }
    public string? ProviderMessageReference { get; set; }
    public string DeliveryStatus { get; set; } = OtpDeliveryStates.Pending;
}
