namespace Hana.Infrastructure.Identity;

/// <summary>
/// Durable bearer session: only a SHA-256 digest, never the bearer secret.
/// A verified phone account is NOT a seller or beneficiary approval.
/// </summary>
public sealed class AuthSessionRecord
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public byte[] TokenDigest { get; set; } = null!;
    public DateTimeOffset IssuedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
}
