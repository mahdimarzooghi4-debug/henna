using Hana.Domain.Identity;

namespace Hana.Domain.Tests.Identity;

public sealed class IranianMobileNumberTests
{
    [Theory]
    [InlineData("09123456789")]
    [InlineData("۰۹۱۲۳۴۵۶۷۸۹")]
    [InlineData("٠٩١٢٣٤٥٦٧٨٩")]
    [InlineData(" ۰۹1٢۳۴٥۶۷۸٩ ")]
    public void AcceptsElevenDigitsStartingWith09AndNormalizesKeypads(string input)
    {
        Assert.True(IranianMobileNumber.TryParse(input, out var mobile));
        Assert.NotNull(mobile);
        Assert.Equal("09123456789", mobile.Value);
        Assert.Equal("[redacted mobile]", mobile.ToString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("123")]
    [InlineData("0912345678")]
    [InlineData("091234567890")]
    [InlineData("08123456789")]
    [InlineData("+989123456789")]
    [InlineData("۰۹۱۲۳۴۵۶۷۸x")]
    [InlineData("09123 456789")]
    public void RejectsInvalidPhoneNumbers(string? input)
    {
        Assert.False(IranianMobileNumber.TryParse(input, out var mobile));
        Assert.Null(mobile);
    }
}
