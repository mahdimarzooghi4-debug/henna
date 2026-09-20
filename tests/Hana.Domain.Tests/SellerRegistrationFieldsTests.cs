using Hana.Domain.Seller;

namespace Hana.Domain.Tests;

public sealed class SellerRegistrationFieldsTests
{
    [Fact]
    public void ValidPersianDigitsAreNormalizedAndSpacesAreTrimmed()
    {
        Assert.True(SellerRegistrationFields.TryCreate(
            " فروشگاه بهار ", " مسئول فروشگاه ", "۰۹۱۲۳۴۵۶۷۸۹",
            " تهران ", " خیابان نمونه ", "۱۲۳۴۵۶۷۸۹۰",
            out var result));
        Assert.NotNull(result);
        Assert.Equal("فروشگاه بهار", result.StoreName);
        Assert.Equal("09123456789", result.Phone);
        Assert.Equal("1234567890", result.PostalCode);
    }

    [Theory]
    [InlineData("", "09123456789", "1234567890")]
    [InlineData("فروشگاه", "123", "1234567890")]
    [InlineData("فروشگاه", "09123456789", "123456789")]
    [InlineData("فروشگاه", "09123456789", "123456789x")]
    public void MissingOrMalformedFieldsAreRejected(
        string name, string phone, string postal)
    {
        Assert.False(SellerRegistrationFields.TryCreate(
            name, "مسئول", phone, "تهران", "نشانی", postal, out _));
    }

    [Fact]
    public void OversizedAndControlCharactersAreRejected()
    {
        Assert.False(SellerRegistrationFields.TryCreate(
            new string('x', 121), "owner", "09123456789",
            "city", "address", "1234567890", out _));
        Assert.False(SellerRegistrationFields.TryCreate(
            "store", "owner", "09123456789", "city",
            "address\nsecond line", "1234567890", out _));
    }
}
