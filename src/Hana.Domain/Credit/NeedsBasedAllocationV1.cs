using Hana.Domain.Money;

namespace Hana.Domain.Credit;

/// <summary>
/// Deterministic first-version needs-based allocation math. It calculates one
/// household at a time and does not read, reserve, or mutate wallet balances.
/// </summary>
public static class NeedsBasedAllocationV1
{
    public const decimal HealthWeight = 0.30m;
    public const decimal EconomicHardshipWeight = 0.20m;
    public const decimal AgeAndDependencyWeight = 0.15m;
    public const decimal HouseholdSizeWeight = 0.10m;
    public const decimal CareAndSupportWeight = 0.10m;
    public const decimal EducationWeight = 0.05m;
    public const decimal HousingTenureWeight = 0.10m;

    public const decimal MinimumGeographicFactor = 0.8m;
    public const decimal MaximumGeographicFactor = 1.2m;
    public const decimal ProvincialCapitalAdjustment = 1.2m;
    public const decimal MaximumHouseholdAdjustment = 1.5m;

    public static decimal CalculateHouseholdFactor(HouseholdNeedScores scores)
    {
        ArgumentNullException.ThrowIfNull(scores);

        var weightedScore =
            HealthWeight * scores.Health +
            EconomicHardshipWeight * scores.EconomicHardship +
            AgeAndDependencyWeight * scores.AgeAndDependency +
            HouseholdSizeWeight * scores.HouseholdSize +
            CareAndSupportWeight * scores.CareAndSupport +
            EducationWeight * scores.Education +
            HousingTenureWeight * scores.HousingTenure;

        return 1m + 0.5m * weightedScore / 3m;
    }

    /// <summary>
    /// Maps the selected urban or rural provincial MPI value to the pilot
    /// range. The caller selects the urban/rural input and supplies the
    /// min/max from the same versioned geography dataset.
    /// </summary>
    public static decimal CalculateGeographicFactor(
        decimal mpi,
        decimal minimumMpi,
        decimal maximumMpi,
        bool isProvincialCapital)
    {
        if (minimumMpi < 0m || maximumMpi > 1m || minimumMpi >= maximumMpi)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumMpi),
                "MPI bounds must satisfy 0 <= minimum < maximum <= 1.");
        }

        if (mpi < minimumMpi || mpi > maximumMpi)
        {
            throw new ArgumentOutOfRangeException(nameof(mpi),
                "MPI must be within the bounds of the same geography dataset.");
        }

        var normalized = MinimumGeographicFactor +
            (MaximumGeographicFactor - MinimumGeographicFactor) *
            (mpi - minimumMpi) / (maximumMpi - minimumMpi);

        return isProvincialCapital
            ? normalized * ProvincialCapitalAdjustment
            : normalized;
    }

    /// <summary>
    /// Calculates an independently adjusted amount. The source's per-household
    /// base is also the default ceiling; no unused balance is redistributed.
    /// Amounts are rounded down to whole rials before applying the ceiling.
    /// </summary>
    public static HouseholdAllocationResult CalculatePerHousehold(
        RialAmount baseAmount,
        RialAmount ceiling,
        decimal geographicFactor,
        HouseholdNeedScores scores)
    {
        ArgumentNullException.ThrowIfNull(scores);

        if (baseAmount.Value == 0)
        {
            throw new ArgumentOutOfRangeException(nameof(baseAmount),
                "The per-household base amount must be greater than zero.");
        }

        if (ceiling.Value == 0 || ceiling.Value > baseAmount.Value)
        {
            throw new ArgumentOutOfRangeException(nameof(ceiling),
                "The ceiling must be greater than zero and no greater than the per-household base.");
        }

        if (geographicFactor <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(geographicFactor),
                "The geographic factor must be greater than zero.");
        }

        var householdFactor = CalculateHouseholdFactor(scores);
        var calculated = decimal.Floor(
            baseAmount.Value * geographicFactor * householdFactor);
        var payable = Math.Min(calculated, ceiling.Value);

        return new HouseholdAllocationResult(
            householdFactor,
            geographicFactor,
            new RialAmount(checked((long)calculated)),
            new RialAmount(checked((long)payable)),
            new RialAmount(checked((long)(baseAmount.Value - payable))));
    }
}

public sealed record HouseholdAllocationResult(
    decimal HouseholdFactor,
    decimal GeographicFactor,
    RialAmount CalculatedAmount,
    RialAmount PayableAmount,
    RialAmount UnusedFromBase);
