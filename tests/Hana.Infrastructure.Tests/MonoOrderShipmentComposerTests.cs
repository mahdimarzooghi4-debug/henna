using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.External;

namespace Hana.Infrastructure.Tests;

public sealed class MonoOrderShipmentComposerTests
{
    private static readonly Guid SellerId =
        Guid.Parse("71000000-0000-4000-8000-000000000001");
    private static readonly Guid BuyerId =
        Guid.Parse("71000000-0000-4000-8000-000000000002");
    private static readonly Guid ProductA =
        Guid.Parse("71000000-0000-4000-8000-000000000003");
    private static readonly Guid ProductB =
        Guid.Parse("71000000-0000-4000-8000-000000000004");

    [Fact]
    public void ComposesPerUnitProfilesAcrossProductsAndQuantities()
    {
        var order = DeliveryOrder(new(
            Guid.NewGuid(), Guid.NewGuid(), ProductA, 2, 1000, 0, 0, 0),
            new(Guid.NewGuid(), Guid.NewGuid(), ProductB, 1, 2000, 0, 0, 0));
        var profiles = new[]
        {
            Profile(ProductA, bagCount: 1, loadClass: "S",
                weight: 1.25m, packageCount: 1, volume: 0.01m,
                fragile: false, liquid: false, keepUpright: true,
                temperature: "AMBIENT"),
            Profile(ProductB, bagCount: 2, loadClass: "L",
                weight: 2m, packageCount: 2, volume: 0.03m,
                fragile: true, liquid: false, keepUpright: false,
                temperature: "AMBIENT")
        };

        var result = MonoOrderShipmentComposer.Compose(order, profiles);

        Assert.True(result.Ready);
        Assert.Empty(result.BlockingReasons);
        Assert.NotNull(result.Shipment);
        Assert.Equal(4, result.Shipment!.BagCount);
        Assert.Equal("L", result.Shipment.LoadClass);
        Assert.Equal(4.5m, result.Shipment.EstimatedWeightKg);
        Assert.Equal(4, result.Shipment.PackageCount);
        Assert.Equal(0.05m, result.Shipment.EstimatedVolumeM3);
        Assert.True(result.Shipment.Fragile);
        Assert.False(result.Shipment.Liquid);
        Assert.True(result.Shipment.KeepUpright);
        Assert.Equal("AMBIENT", result.Shipment.TemperatureClass);
    }

    [Fact]
    public void BlocksWhenAnyOrderProductHasNoSellerProfile()
    {
        var order = DeliveryOrder(new(
            Guid.NewGuid(), Guid.NewGuid(), ProductA, 1, 1000, 0, 0, 0));

        var result = MonoOrderShipmentComposer.Compose(order,
            Array.Empty<MonoSellerProductPackagingProfile>());

        Assert.False(result.Ready);
        Assert.Null(result.Shipment);
        Assert.Contains("PACKAGING_PROFILE_MISSING", result.BlockingReasons);
    }

    [Fact]
    public void BlocksConflictingTemperatureClasses()
    {
        var order = DeliveryOrder(
            new(Guid.NewGuid(), Guid.NewGuid(), ProductA, 1, 1000, 0, 0, 0),
            new(Guid.NewGuid(), Guid.NewGuid(), ProductB, 1, 2000, 0, 0, 0));
        var profiles = new[]
        {
            Profile(ProductA, temperature: "CHILLED"),
            Profile(ProductB, temperature: "FROZEN")
        };

        var result = MonoOrderShipmentComposer.Compose(order, profiles);

        Assert.False(result.Ready);
        Assert.Null(result.Shipment);
        Assert.Contains("MIXED_TEMPERATURE_CLASSES", result.BlockingReasons);
    }

    [Fact]
    public void IgnoresOtherSellersAndRejectsDuplicateOwnProfiles()
    {
        var order = DeliveryOrder(new(
            Guid.NewGuid(), Guid.NewGuid(), ProductA, 1, 1000, 0, 0, 0));
        var foreign = Profile(ProductA) with
        {
            SellerId = Guid.NewGuid()
        };

        var missing = MonoOrderShipmentComposer.Compose(order, new[] { foreign });
        Assert.Contains("PACKAGING_PROFILE_MISSING", missing.BlockingReasons);

        var duplicate = MonoOrderShipmentComposer.Compose(order,
            new[] { Profile(ProductA), Profile(ProductA) });
        Assert.Contains("PACKAGING_PROFILE_AMBIGUOUS", duplicate.BlockingReasons);
    }

    private static Order DeliveryOrder(params OrderItem[] items) =>
        new(
            Guid.NewGuid(), BuyerId, SellerId, "PERSONAL", "DELIVERY",
            new(Guid.NewGuid(), BuyerId, Guid.NewGuid(), "نشانی آزمایشی",
                35.7m, 51.4m),
            items.ToList(), 1000, 1000, 0, null, "PAID", "NONE", 1,
            DateTimeOffset.UtcNow, null, null);

    private static MonoSellerProductPackagingProfile Profile(
        Guid productId,
        int bagCount = 1,
        string loadClass = "M",
        decimal? weight = null,
        int? packageCount = null,
        decimal? volume = null,
        bool? fragile = null,
        bool? liquid = null,
        bool? keepUpright = null,
        string? temperature = null) =>
        new(
            Guid.NewGuid(), SellerId, productId, "BAG_BASED", bagCount,
            loadClass, weight, fragile, liquid, keepUpright, packageCount,
            volume, temperature, 1, DateTimeOffset.UtcNow);
}
