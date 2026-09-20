using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Hana.Infrastructure.ImportReview;

/// <summary>
/// A deterministic digest of the imported identities' relevant persisted rows.
/// This is a concurrency guard, NOT a signature, human review or whole-DB hash.
/// </summary>
public static class ImportStateChecksum
{
    public static string Compute<T>(T sortedRows)
    {
        var json = JsonSerializer.Serialize(sortedRows);
        return Convert.ToHexStringLower(SHA256.HashData(
            Encoding.UTF8.GetBytes(json)));
    }

    public static void RequireMatch(string? reviewed, string observed)
    {
        if (reviewed is null) return; // Internal tests may exercise import directly.
        if (reviewed.Length != 64 || observed.Length != 64 ||
            !reviewed.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f') ||
            !CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(reviewed),
                Convert.FromHexString(observed)))
            throw new InvalidDataException(
                "Imported database state differs from preview; no rows " +
                "or receipt were applied. Re-preview and reapprove.");
    }
}
