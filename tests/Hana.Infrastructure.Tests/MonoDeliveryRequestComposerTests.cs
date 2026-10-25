using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.External;

namespace Hana.Infrastructure.Tests;

public sealed class MonoDeliveryRequestComposerTests
{
    private static readonly Guid BuyerId =
        Guid.Parse("72000000-0000-4000-8000-000000000001");
    private static readonly Guid OrderId =
        Guid.Parse("72000000-0000-4000-8000-000000000002");
    private const string BranchId = "br_0123456789abcdef0123456789abcdef";

    [Fact]
    public void ComposesRequestFromActiveMappedBranchAndDeliveryOrder()
    {
        var order = DeliveryOrder();
        var branch = new MonoBranchSummary(BranchId, "Branch", "تهران",
            35.7m, 51.4m, "tehran", "ACTIVE");
        var shipment = new MonoOrderShipmentComposition(true,
            new MonoShipment("BAG_BASED", 2, "M"),
            Array.Empty<string>());

        var result = MonoDeliveryRequestComposer.Compose(
            order, BranchId, branch, shipment);

        Assert.True(result.Ready);
        Assert.Empty(result.BlockingReasons);
        Assert.NotNull(result.Request);
        Assert.True(result.Request!.IsValid());
        Assert.Equal(OrderId.ToString("N"), result.Request.ExternalReference);
        Assert.Equal(BranchId, result.Request.BranchId);
        Assert.Equal(35.7m, result.Request.Pickup.Latitude);
        Assert.Equal(51.4m, result.Request.Dropoff.Longitude);
        Assert.Equal("URBAN_DELIVERY", result.Request.RequestedService);
    }

    [Fact]
    public void BlocksInactiveOrDifferentMappedBranch()
    {
        var shipment = ReadyShipment();
        var inactive = new MonoBranchSummary(BranchId, "Branch", "تهران",
            35.7m, 51.4m, "tehran", "SUSPENDED");
        var mismatch = new MonoBranchSummary(
            "br_abcdef0123456789abcdef0123456789", "Other", "تهران",
            35.7m, 51.4m, "tehran", "ACTIVE");

        var inactiveResult = MonoDeliveryRequestComposer.Compose(
            DeliveryOrder(), BranchId, inactive, shipment);
        var mismatchResult = MonoDeliveryRequestComposer.Compose(
            DeliveryOrder(), BranchId, mismatch, shipment);

        Assert.Contains("MONO_BRANCH_NOT_ACTIVE", inactiveResult.BlockingReasons);
        Assert.Contains("MONO_BRANCH_MAPPING_MISMATCH", mismatchResult.BlockingReasons);
        Assert.Null(inactiveResult.Request);
        Assert.Null(mismatchResult.Request);
    }

    [Fact]
    public void BlocksMissingMappingShipmentAndDropoffLocation()
    {
        var invalidOrder = DeliveryOrder() with
        {
            Address = new BuyerAddress(Guid.NewGuid(), BuyerId, Guid.NewGuid(),
                "", 0, 0)
        };
        var branch = new MonoBranchSummary(BranchId, "Branch", null,
            null, null, null, "ACTIVE");

        var result = MonoDeliveryRequestComposer.Compose(
            invalidOrder, null, branch,
            new MonoOrderShipmentComposition(false, null,
                new[] { "PACKAGING_PROFILE_MISSING" }));

        Assert.Contains("SELLER_BRANCH_MAPPING_MISSING", result.BlockingReasons);
        Assert.Contains("SHIPMENT_NOT_READY", result.BlockingReasons);
        Assert.Contains("DROPOFF_LOCATION_REQUIRED", result.BlockingReasons);
        Assert.Contains("PICKUP_LOCATION_REQUIRED", result.BlockingReasons);
        Assert.Null(result.Request);
    }

    private static MonoOrderShipmentComposition ReadyShipment() =>
        new(true, new MonoShipment("BAG_BASED", 1, "S"),
            Array.Empty<string>());

    private static Order DeliveryOrder() =>
        new(
            OrderId, BuyerId, Guid.NewGuid(), "PERSONAL", "DELIVERY",
            new BuyerAddress(Guid.NewGuid(), BuyerId, Guid.NewGuid(),
                "خیابان آزمایشی", 35.7m, 51.4m),
            new List<OrderItem>
            {
                new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                    1, 1000, 0, 0, 0)
            },
            1000, 1000, 0, null, "PAID", "NONE", 1,
            DateTimeOffset.UtcNow, null, null);
}
