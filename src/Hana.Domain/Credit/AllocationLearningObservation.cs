namespace Hana.Domain.Credit;

public enum AllocationOutcomeEvidence { Administrative = 1, HouseholdReported = 2, HumanReviewed = 3 }

/// <summary>Structured outcome; unknown measurements stay null, never become zero.</summary>
public sealed record AllocationLearningObservation
{
    public Guid EventId { get; }
    public Guid SnapshotId { get; }
    public DateTimeOffset PeriodStartUtc { get; }
    public DateTimeOffset PeriodEndUtc { get; }
    public decimal? CreditUsedRial { get; }
    public decimal? EssentialNeedsCoverage { get; }
    public bool? StockBarrier { get; }
    public bool? DeliveryBarrier { get; }
    public bool? AccessBarrier { get; }
    public AllocationOutcomeEvidence Evidence { get; }

    public AllocationLearningObservation(Guid eventId, Guid snapshotId,
        DateTimeOffset periodStartUtc, DateTimeOffset periodEndUtc,
        decimal? creditUsedRial, decimal? essentialNeedsCoverage,
        bool? stockBarrier, bool? deliveryBarrier, bool? accessBarrier,
        AllocationOutcomeEvidence evidence)
    {
        if (eventId == Guid.Empty || snapshotId == Guid.Empty)
            throw new ArgumentException("Event and snapshot identifiers are required.");
        if (periodStartUtc.Offset != TimeSpan.Zero || periodEndUtc.Offset != TimeSpan.Zero ||
            periodStartUtc >= periodEndUtc)
            throw new ArgumentException("A positive UTC observation interval is required.");
        if (creditUsedRial is < 0m || (creditUsedRial.HasValue &&
            decimal.Truncate(creditUsedRial.Value) != creditUsedRial.Value))
            throw new ArgumentOutOfRangeException(nameof(creditUsedRial));
        if (essentialNeedsCoverage is < 0m or > 1m)
            throw new ArgumentOutOfRangeException(nameof(essentialNeedsCoverage));
        if (!Enum.IsDefined(evidence)) throw new ArgumentOutOfRangeException(nameof(evidence));
        if (creditUsedRial is null && essentialNeedsCoverage is null && stockBarrier is null &&
            deliveryBarrier is null && accessBarrier is null)
            throw new ArgumentException("At least one measured outcome is required.");
        EventId = eventId; SnapshotId = snapshotId;
        PeriodStartUtc = periodStartUtc; PeriodEndUtc = periodEndUtc;
        CreditUsedRial = creditUsedRial; EssentialNeedsCoverage = essentialNeedsCoverage;
        StockBarrier = stockBarrier; DeliveryBarrier = deliveryBarrier;
        AccessBarrier = accessBarrier; Evidence = evidence;
    }
}
