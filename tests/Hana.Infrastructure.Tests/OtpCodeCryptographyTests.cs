using Hana.Infrastructure.Identity;
using System.Security.Cryptography;

namespace Hana.Infrastructure.Tests;

public sealed class OtpCodeCryptographyTests
{
    [Fact]
    public void CodesAlwaysHaveSixAsciiDigits()
    {
        for (var i = 0; i < 128; i++)
        {
            var code = OtpCodeCryptography.GenerateCode();
            Assert.True(OtpCodeCryptography.IsSixDigitCode(code));
        }
    }

    [Fact]
    public void SecretMustBeHighEntropy()
    {
        Assert.Throws<ArgumentException>(() => new OtpCodeCryptography(new byte[31]));
        Assert.Throws<ArgumentNullException>(() => new OtpCodeCryptography(null!));
    }

    [Fact]
    public void DigestBindsCodeToChallengeAndPhoneAndSecret()
    {
        var id = Guid.NewGuid();
        var cryptography = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var otherKey = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var digest = cryptography.ComputeDigest(id, "09123456789", "000123");

        Assert.Equal(32, digest.Length);
        Assert.True(cryptography.VerifyDigest(id, "09123456789", "000123", digest));
        Assert.False(cryptography.VerifyDigest(Guid.NewGuid(), "09123456789", "000123", digest));
        Assert.False(cryptography.VerifyDigest(id, "09123456788", "000123", digest));
        Assert.False(cryptography.VerifyDigest(id, "09123456789", "000124", digest));
        Assert.False(cryptography.VerifyDigest(id, "09123456789", "۰۰۰۱۲۳", digest));
        Assert.False(cryptography.VerifyDigest(id, "09123456789", "000123", new byte[31]));
        Assert.False(otherKey.VerifyDigest(id, "09123456789", "000123", digest));
    }
}
