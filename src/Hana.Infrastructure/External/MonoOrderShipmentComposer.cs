using Hana.Infrastructure.Commerce;

namespace Hana.Infrastructure.External;

public sealed record MonoOrderShipmentComposition(
    bool Ready,
    MonoShipment? Shipment,
    IReadOnlyList<string> BlockingReasons);

/// <summary>
/// Composes seller-declared per-unit package data for a delivery order.
/// This is a pure preparation step and never calls the Mono provider.
/// </summary>
public static class MonoOrderShipmentComposer
{
    public static MonoOrderShipmentComposition Compose(
        Order? order,
        IEnumerable<MonoSellerProductPackagingProfile>? profiles)
    {
        var blockers = new SortedSet<string>(StringComparer.Ordinal);
        if (order is null)
            return Block("ORDER_NOT_FOUND");
        if (order.FulfillmentMode != "DELIVERY" ||
            order.State is "CANCELLED" or "COLLECTED")
            return Block("ORDER_NOT_DELIVERABLE");
        if (order.Items is null || order.Items.Count == 0)
            return Block("ORDER_ITEMS_REQUIRED");
        if (profiles is null)
            return Block("PACKAGING_PROFILES_REQUIRED");

        var ownedProfiles = profiles
            .Where(profile => profile.SellerId == order.SellerId)
            .GroupBy(profile => profile.ProductId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var lineProfiles = new List<(OrderItem Item, MonoSellerProductPackagingProfile Profile)>();
        foreach (var item in order.Items)
        {
            if (item.Quantity < 1)
            {
                blockers.Add("ORDER_ITEM_INVALID");
                continue;
            }

            if (!ownedProfiles.TryGetValue(item.ProductId, out var matches) ||
                matches.Count == 0)
            {
                blockers.Add("PACKAGING_PROFILE_MISSING");
                continue;
            }
            if (matches.Count != 1)
            {
                blockers.Add("PACKAGING_PROFILE_AMBIGUOUS");
                continue;
            }

            var profile = matches[0];
            var shipment = ToShipment(profile);
            if (profile.Version < 1 || !shipment.IsValid())
            {
                blockers.Add("PACKAGING_PROFILE_INVALID");
                continue;
            }
            lineProfiles.Add((item, profile));
        }

        if (blockers.Count > 0)
            return new(false, null, blockers.ToArray());

        var temperatures = lineProfiles
            .Select(line => line.Profile.TemperatureClass)
            .Where(value => value is not null)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (temperatures.Length > 1)
            blockers.Add("MIXED_TEMPERATURE_CLASSES");

        if (blockers.Count > 0)
            return new(false, null, blockers.ToArray());

        try
        {
            var bagCount = 0;
            var packageCount = 0;
            decimal weight = 0;
            decimal volume = 0;
            var hasWeight = lineProfiles.All(line =>
                line.Profile.EstimatedWeightKg is not null);
            var hasPackageCount = lineProfiles.All(line =>
                line.Profile.PackageCount is not null);
            var hasVolume = lineProfiles.All(line =>
                line.Profile.EstimatedVolumeM3 is not null);
            var loadClass = "S";

            foreach (var (item, profile) in lineProfiles)
            {
                bagCount = checked(bagCount +
                    checked(profile.BagCount * item.Quantity));
                if (hasPackageCount)
                    packageCount = checked(packageCount +
                        checked(profile.PackageCount!.Value * item.Quantity));
                if (hasWeight)
                    weight = checked(weight +
                        checked(profile.EstimatedWeightKg!.Value * item.Quantity));
                if (hasVolume)
                    volume = checked(volume +
                        checked(profile.EstimatedVolumeM3!.Value * item.Quantity));
                if (LoadRank(profile.LoadClass) > LoadRank(loadClass))
                    loadClass = profile.LoadClass;
            }

            var shipment = new MonoShipment(
                "BAG_BASED",
                bagCount,
                loadClass,
                hasWeight ? weight : null,
                AnyTrueOrAllKnownFalse(lineProfiles.Select(x => x.Profile.Fragile)),
                AnyTrueOrAllKnownFalse(lineProfiles.Select(x => x.Profile.Liquid)),
                AnyTrueOrAllKnownFalse(lineProfiles.Select(x => x.Profile.KeepUpright)),
                hasPackageCount ? packageCount : null,
                hasVolume ? volume : null,
                temperatures.SingleOrDefault());

            if (!shipment.IsValid())
                return Block("COMPOSED_SHIPMENT_INVALID");

            return new(true, shipment, Array.Empty<string>());
        }
        catch (OverflowException)
        {
            return Block("COMPOSED_SHIPMENT_OVERFLOW");
        }

        MonoOrderShipmentComposition Block(string reason) =>
            new(false, null, new[] { reason });
    }

    private static MonoShipment ToShipment(
        MonoSellerProductPackagingProfile profile) =>
        new(
            profile.ShipmentModel,
            profile.BagCount,
            profile.LoadClass,
            profile.EstimatedWeightKg,
            profile.Fragile,
            profile.Liquid,
            profile.KeepUpright,
            profile.PackageCount,
            profile.EstimatedVolumeM3,
            profile.TemperatureClass);

    private static int LoadRank(string loadClass) => loadClass switch
    {
        "S" => 1,
        "M" => 2,
        "L" => 3,
        _ => 0
    };

    private static bool? AnyTrueOrAllKnownFalse(IEnumerable<bool?> values)
    {
        var flags = values.ToArray();
        if (flags.Any(value => value is true))
            return true;
        return flags.All(value => value is false) ? false : null;
    }
}
