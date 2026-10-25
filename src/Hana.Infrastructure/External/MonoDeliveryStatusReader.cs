namespace Hana.Infrastructure.External;

public sealed record MonoDeliveryStatusRead(
    Guid OrderId,
    string CorrelationState,
    string? DeliveryRequestId,
    string? ProviderStatus,
    string? MissionId,
    string? MissionStatus,
    DateTimeOffset? CommittedDeliveryAt,
    MonoDeliveryQuote? Quote,
    MonoDeliveryPromise? Promise,
    DateTimeOffset CorrelationUpdatedAtUtc,
    int CorrelationRevision,
    MonoCourierCurrentLocation? CourierLocation = null);

/// <summary>
/// Reconciles one Henna order against Mono's tenant-scoped delivery detail.
/// Provider request payloads and personal/location data are never persisted.
/// </summary>
public sealed class MonoDeliveryStatusReader(
    IMonoDeliveryCorrelationStore correlations,
    IMonoLogisticsClient mono)
{
    private static readonly HashSet<string> LocationEligibleStatuses = new(StringComparer.Ordinal)
    {
        "COURIER_ASSIGNED", "ARRIVED_PICKUP", "HANDED_TO_COURIER",
        "PICKED_UP", "IN_TRANSIT", "ARRIVED_DROPOFF"
    };
    public async Task<MonoDeliveryStatusRead> ReadAsync(
        Guid orderId, CancellationToken cancellationToken = default)
    {
        if (orderId == Guid.Empty)
            throw new ArgumentException("Order id is required.", nameof(orderId));

        var correlation = await correlations.FindAsync(orderId, cancellationToken)
            ?? throw new MonoDeliveryCorrelationException("CORRELATION_NOT_FOUND");

        if (correlation.DeliveryRequestId is null)
            return ToRead(correlation, null);

        var detail = await mono.GetDeliveryRequestAsync(
            correlation.DeliveryRequestId, cancellationToken);
        if (detail.DeliveryRequestId != correlation.DeliveryRequestId
            || detail.ExternalReference != orderId.ToString("N")
            || !detail.HasValidQuoteAndPromise())
            throw new MonoLogisticsException(
                System.Net.HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");

        if (detail.MissionId is not null)
            correlation = await correlations.RecordMissionAsync(
                orderId, detail, cancellationToken);

        MonoCourierCurrentLocation? courierLocation = null;
        var missionId = correlation.MissionId ?? detail.MissionId;
        if (missionId is not null && detail.MissionStatus is not null
            && LocationEligibleStatuses.Contains(detail.MissionStatus))
            courierLocation = await mono.GetCourierCurrentLocationAsync(
                missionId, cancellationToken);

        return ToRead(correlation, detail, courierLocation);
    }

    private static MonoDeliveryStatusRead ToRead(
        MonoDeliveryCorrelationSnapshot correlation,
        MonoDeliveryRequestDetail? detail,
        MonoCourierCurrentLocation? courierLocation = null) =>
        new(correlation.OrderId, correlation.State, correlation.DeliveryRequestId,
            detail?.Status, correlation.MissionId ?? detail?.MissionId,
            detail?.MissionStatus, detail?.CommittedDeliveryAt,
            detail?.Quote, detail?.Promise,
            correlation.UpdatedAtUtc, correlation.Revision, courierLocation);
}
