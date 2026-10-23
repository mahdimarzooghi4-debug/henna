using System.Security.Cryptography;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Research-only artifact-byte integrity check; this does NOT validate
/// source rights, model quality, runtime compatibility or human approval.
/// </summary>
public static class AllocationModelArtifactAttestation
{
    public static bool Matches(byte[]? artifactBytes, string? expectedSha256)
    {
        if (artifactBytes is not { Length: > 0 } ||
            expectedSha256 is null || expectedSha256.Length != 64 ||
            expectedSha256.Any(c => c is not (>= '0' and <= '9' or >= 'a' and <= 'f')))
            return false;
        var actual = SHA256.HashData(artifactBytes);
        return CryptographicOperations.FixedTimeEquals(
            actual, Convert.FromHexString(expectedSha256));
    }
}
