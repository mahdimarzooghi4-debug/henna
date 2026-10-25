using Hana.Infrastructure.Commerce;

namespace Hana.Infrastructure.External;

public sealed record MonoDeliveryRequestComposition(
    bool Ready,
    MonoDeliveryRequestInput? Request,
    IReadOnlyList<string> BlockingReasons);

/// <summary>
/// Builds the provider request from a currently active mapped branch,
/// a delivery order and a previously composed shipment. This class has no
/// network or persistence side effects.
/// </summary>
public static class MonoDeliveryRequestComposer
{
    public static MonoDeliveryRequestComposition Compose(
        Order? order,
        string? mappedBranchId,
        MonoBranchSummary? branch,
        MonoOrderShipmentComposition? shipment)
    {
        var blockers = new SortedSet<string>(StringComparer.Ordinal);
        if (order is null)
            blockers.Add("ORDER_NOT_FOUND");
        else if (order.FulfillmentMode != "DELIVERY" ||
                 order.State is "CANCELLED" or "COLLECTED")
            blockers.Add("ORDER_NOT_DELIVERABLE");

        if (mappedBranchId is null || !MonoIds.IsBranchId(mappedBranchId))
            blockers.Add("SELLER_BRANCH_MAPPING_MISSING");
        if (branch is null || branch.Status != "ACTIVE")
            blockers.Add("MONO_BRANCH_NOT_ACTIVE");
        else if (branch.BranchId != mappedBranchId)
            blockers.Add("MONO_BRANCH_MAPPING_MISMATCH");

        if (shipment is null || !shipment.Ready || shipment.Shipment is null)
            blockers.Add("SHIPMENT_NOT_READY");

        if (order?.Address is null ||
            string.IsNullOrWhiteSpace(order.Address.Text) &&
            (order.Address.Latitude is < -90 or > 90 ||
             order.Address.Longitude is < -180 or > 180))
            blockers.Add("DROPOFF_LOCATION_REQUIRED");

        if (branch is not null &&
            string.IsNullOrWhiteSpace(branch.Address) &&
            (branch.Latitude is null || branch.Longitude is null))
            blockers.Add("PICKUP_LOCATION_REQUIRED");

        if (blockers.Count > 0)
            return new(false, null, blockers.ToArray());

        var pickup = new MonoDeliveryLocation(
            branch!.Address, branch.Latitude, branch.Longitude);
        var address = order!.Address;
        var dropoff = new MonoDeliveryLocation(
            address.Text, address.Latitude, address.Longitude);
        var request = new MonoDeliveryRequestInput(
            order.Id.ToString("N"),
            mappedBranchId!,
            pickup,
            dropoff,
            shipment!.Shipment!);

        if (!request.IsValid())
            return new(false, null, new[] { "DELIVERY_REQUEST_INVALID" });

        return new(true, request, Array.Empty<string>());
    }
}
