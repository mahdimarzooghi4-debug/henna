using Hana.Domain.Money;

namespace Hana.Domain.Credit;

public enum CreditAllocationModeV1
{
    EqualWalletTopUp = 1,
    NeedsBased = 2
}

public sealed record CreditAllocationModeResultV1(
    CreditAllocationModeV1 Mode,
    HouseholdAllocationResult Household);

/// <summary>
/// Explicitly selects between equal wallet top-ups and needs-based per-household
/// calculation. Callers must choose a method; no default mode is provided.
/// This class calculates only and does not validate funding authority or mutate
/// any wallet or ledger.
/// </summary>
public static class CreditAllocationModesV1
{
    public static CreditAllocationModeResultV1 CalculateEqualWalletTopUp(RialAmount amount)
    {
        if (amount.Value <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount),
                "An equal wallet top-up amount must be greater than zero.");
        }

        var household = new HouseholdAllocationResult(
            HouseholdFactor: 1m,
            GeographicFactor: 1m,
            CalculatedAmount: amount,
            PayableAmount: amount,
            UnusedFromBase: new RialAmount(0));

        return new CreditAllocationModeResultV1(
            CreditAllocationModeV1.EqualWalletTopUp, household);
    }

    public static CreditAllocationModeResultV1 CalculateNeedsBased(
        RialAmount baseAmount,
        RialAmount ceiling,
        decimal geographicFactor,
        HouseholdNeedScores scores)
    {
        var household = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount, ceiling, geographicFactor, scores);

        return new CreditAllocationModeResultV1(
            CreditAllocationModeV1.NeedsBased, household);
    }
}
