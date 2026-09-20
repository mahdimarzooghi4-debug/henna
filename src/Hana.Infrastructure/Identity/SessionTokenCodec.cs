using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Opaque 256-bit bearer secret; never persist or log the raw token.
/// Prefix separates it from OTP codes and future credential formats.
/// </summary>
public static class SessionTokenCodec
{
    private const string Prefix = "hn1_";
    private const string DigestDomain = "hana-auth-session-v1:";

    public static string Generate() =>
        Prefix + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static bool TryComputeDigest(string? token, out byte[] digest)
    {
        digest = [];
        if (token is null || token.Length != Prefix.Length + 43 ||
            !token.StartsWith(Prefix, StringComparison.Ordinal))
            return false;

        var encoded = token.AsSpan(Prefix.Length);
        for (var i = 0; i < encoded.Length; i++)
        {
            var ch = encoded[i];
            if (!(ch is >= 'a' and <= 'z' or >= 'A' and <= 'Z'
                or >= '0' and <= '9' or '-' or '_'))
                return false;
        }

        var padded = new string(encoded).Replace('-', '+').Replace('_', '/') + "=";
        Span<byte> decoded = stackalloc byte[32];
        if (!Convert.TryFromBase64String(padded, decoded, out var written) ||
            written != 32)
            return false;

        digest = SHA256.HashData(Encoding.UTF8.GetBytes(DigestDomain + token));
        return true;
    }
}
