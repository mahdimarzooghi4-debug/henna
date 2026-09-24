using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Organization;

/// <summary>
/// Keyed pseudonymization for organization recipient identifiers. The key is
/// independent from OTP/authentication secrets. Fingerprints are for duplicate
/// and idempotency detection only and must never be used as identity proof.
/// </summary>
public sealed class OrganizationRecipientCryptography
{
    private readonly byte[] _key;

    public OrganizationRecipientCryptography(byte[] secretKey)
    {
        ArgumentNullException.ThrowIfNull(secretKey);
        if (secretKey.Length < 32)
            throw new ArgumentException(
                "Recipient fingerprint key must contain at least 32 bytes.",
                nameof(secretKey));
        _key = (byte[])secretKey.Clone();
    }

    public string ReferenceFingerprint(
        Guid organizationId,
        Guid programId,
        string normalizedReference)
    {
        if (organizationId == Guid.Empty ||
            programId == Guid.Empty ||
            string.IsNullOrEmpty(normalizedReference))
            throw new ArgumentException(
                "Recipient fingerprint inputs are required.");

        var canonical = string.Join(
            '\0',
            "hana:organization:recipient-reference:v1",
            organizationId.ToString("N"),
            programId.ToString("N"),
            normalizedReference);
        return HexHmac(canonical);
    }

    public string CreationFingerprint(
        Guid organizationId,
        Guid programId,
        string displayName,
        string normalizedReference,
        string? normalizedPhone)
    {
        if (organizationId == Guid.Empty ||
            programId == Guid.Empty ||
            string.IsNullOrEmpty(displayName) ||
            string.IsNullOrEmpty(normalizedReference))
            throw new ArgumentException(
                "Recipient creation fingerprint inputs are required.");

        var canonical = string.Join(
            '\0',
            "hana:organization:recipient-create:v1",
            organizationId.ToString("N"),
            programId.ToString("N"),
            displayName,
            normalizedReference,
            normalizedPhone ?? string.Empty);
        return HexHmac(canonical);
    }

    private string HexHmac(string canonical) =>
        Convert.ToHexString(
            HMACSHA256.HashData(
                _key,
                Encoding.UTF8.GetBytes(canonical)))
            .ToLowerInvariant();
}
