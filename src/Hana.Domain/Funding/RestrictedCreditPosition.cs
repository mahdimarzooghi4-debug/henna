using Hana.Domain.Money;

namespace Hana.Domain.Funding;

/// <summary>
/// A read-only projection of one approved restricted allocation.
///
/// Reserve/consume/release/expiry changes must eventually be derived from
/// transactionally committed ledger events. This does not authorize a payment
/// or change any financial balance. Cash wallet is a DIFFERENT domain.
/// </summary>
public sealed class RestrictedCreditPosition
{
    public ApprovedCreditAllocation Allocation { get; }
    public RialAmount Reserved { get; }
    public RialAmount Consumed { get; }
    public RialAmount Expired { get; }
    public RialAmount Uncommitted { get; }

    public RestrictedCreditPosition(
        ApprovedCreditAllocation allocation,
        RialAmount reserved,
        RialAmount consumed,
        RialAmount expired)
    {
        Allocation = allocation ?? throw new ArgumentNullException(nameof(allocation));

        long used;
        try
        {
            used = checked(checked(reserved.Value + consumed.Value) + expired.Value);
        }
        catch (OverflowException)
        {
            throw new ArgumentOutOfRangeException(nameof(reserved),
                "Projected credit totals exceed supported monetary range.");
        }

        if (used > allocation.AllocatedAmount.Value)
            throw new ArgumentOutOfRangeException(nameof(reserved),
                "Reserved, consumed and expired credit cannot exceed approved allocation.");

        Reserved = reserved;
        Consumed = consumed;
        Expired = expired;
        Uncommitted = new RialAmount(allocation.AllocatedAmount.Value - used);
    }

    public RialAmount AvailableAt(DateTimeOffset instant) =>
        Allocation.IsWithinValidityWindow(instant) ? Uncommitted : new RialAmount(0);

    public bool CanReserve(RialAmount amount, DateTimeOffset instant) =>
        amount.Value > 0 && amount.Value <= AvailableAt(instant).Value;
}
