using System.Security.Cryptography;
using System.Text;

namespace Hana.Api;

/// <summary>
/// Bind an operator's approval to the exact UTF-8 bytes imported, not a file
/// path that can change between preview and apply. Digest is not a credential
/// and does not grant DB access or replace editorial review.
/// </summary>
internal static class ReviewedImportFile
{
    internal static async Task<ReviewedImportInput> LoadAsync(
        string[] args, string module, int maxBytes,
        CancellationToken cancellationToken = default)
    {
        var preview = args.Length > 0 && args[0] == "--" + module + "-preview";
        var apply = args.Length > 0 && args[0] == "--" + module + "-apply";

        if ((!preview && !apply) ||
            (preview && args.Length != 2) ||
            (apply && (args.Length != 6 ||
                args[2] != "--expected-sha256" ||
                !ValidDigest(args[3]) ||
                args[4] != "--expected-db-state-sha256" ||
                !ValidDigest(args[5]))) ||
            !Path.IsPathFullyQualified(args[1]))
            throw new InvalidOperationException(
                "Use --" + module + "-preview <absolute-json-file> or " +
                "--" + module + "-apply <absolute-json-file> " +
                "--expected-sha256 <64-lowercase-hex-file-digest> " +
                "--expected-db-state-sha256 <64-lowercase-hex-db-digest-from-preview>.");

        // Open once, then hash and parse the very same bounded byte snapshot.
        // FileInfo.Length + File.ReadAllText would allow an edit between hash
        // and read, and a size check before a growing file would be unbounded.
        await using var stream = new FileStream(
            args[1], FileMode.Open, FileAccess.Read, FileShare.Read,
            bufferSize: 16_384,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan);
        if (stream.Length is < 1 || stream.Length > maxBytes)
            throw new InvalidDataException(
                "Reviewed import file is empty or exceeds its size limit.");
        using var memory = new MemoryStream();
        var chunk = new byte[16_384];
        while (true)
        {
            var allowed = (int)Math.Min(chunk.Length,
                (long)maxBytes + 1 - memory.Length);
            if (allowed <= 0)
                throw new InvalidDataException(
                    "Reviewed import file exceeds its size limit.");
            var read = await stream.ReadAsync(
                chunk.AsMemory(0, allowed), cancellationToken);
            if (read == 0) break;
            memory.Write(chunk, 0, read);
            if (memory.Length > maxBytes)
                throw new InvalidDataException(
                    "Reviewed import file exceeds its size limit.");
        }

        var bytes = memory.ToArray();
        if (bytes.Length == 0)
            throw new InvalidDataException("Reviewed import file is empty.");
        var digestBytes = SHA256.HashData(bytes);
        var actual = Convert.ToHexStringLower(digestBytes);
        if (apply && !CryptographicOperations.FixedTimeEquals(
                digestBytes, Convert.FromHexString(args[3])))
            throw new InvalidDataException(
                "Reviewed import SHA-256 differs from preview; " +
                "no rows were imported. Preview and approve the new file.");

        string json;
        try
        {
            json = new UTF8Encoding(false, true).GetString(bytes);
        }
        catch (DecoderFallbackException ex)
        {
            throw new InvalidDataException(
                "Reviewed import must contain valid UTF-8 JSON.", ex);
        }

        return new ReviewedImportInput(
            json, actual, preview, apply ? args[5] : null);
    }

    private static bool ValidDigest(string digest) =>
        digest.Length == 64 && digest.All(c =>
            c is >= '0' and <= '9' or >= 'a' and <= 'f');
}

internal sealed record ReviewedImportInput(
    string Json, string Sha256, bool DryRun,
    string? ExpectedDbStateSha256);
