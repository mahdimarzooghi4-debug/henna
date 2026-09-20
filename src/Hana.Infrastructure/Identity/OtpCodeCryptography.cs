using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Generates 6-digit codes with a cryptographic RNG and stores ONLY a keyed
/// digest bound to one challenge ID and normalized mobile number.
/// Do not log, cache or persist the plaintext code.
/// </summary>
public sealed class OtpCodeCryptography
{
    private readonly byte[] _key;

    public OtpCodeCryptography(byte[] secretKey)
    {
        ArgumentNullException.ThrowIfNull(secretKey);
        if (secretKey.Length < 32)
            throw new ArgumentException("OTP digest key must contain at least 32 bytes.",
                nameof(secretKey));
        _key = (byte[])secretKey.Clone();
    }

    public static string GenerateCode() =>
        RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    public byte[] ComputeDigest(Guid challengeId, string normalizedPhone, string code)
    {
        if (challengeId == Guid.Empty)
            throw new ArgumentException("A challenge ID is required.", nameof(challengeId));
        if (normalizedPhone is null || normalizedPhone.Length != 11 ||
            !normalizedPhone.StartsWith("09", StringComparison.Ordinal) ||
            !normalizedPhone.All(ch => ch is >= '0' and <= '9'))
            throw new ArgumentException("A normalized mobile number is required.",
                nameof(normalizedPhone));
        if (!IsSixDigitCode(code))
            throw new ArgumentException("An ASCII six-digit code is required.", nameof(code));

        var message = Encoding.UTF8.GetBytes(
            challengeId.ToString("N") + ":" + normalizedPhone + ":" + code);
        return HMACSHA256.HashData(_key, message);
    }

    public bool VerifyDigest(
        Guid challengeId, string normalizedPhone, string? candidate, byte[]? storedDigest)
    {
        if (!IsSixDigitCode(candidate) || storedDigest is not { Length: 32 })
            return false;

        var computed = ComputeDigest(challengeId, normalizedPhone, candidate!);
        return CryptographicOperations.FixedTimeEquals(computed, storedDigest);
    }

    public static bool IsSixDigitCode(string? value) =>
        value is { Length: 6 } && value.All(ch => ch is >= '0' and <= '9');
}
