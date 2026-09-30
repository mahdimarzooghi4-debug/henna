using Hana.Domain.Money;

namespace Hana.Domain.Credit;

public sealed record NeedsBasedHouseholdQuoteV1(
    string FormulaVersion,
    string HouseholdScoringVersion,
    string GeographyDatasetVersion,
    HouseholdNeedScores HouseholdScores,
    decimal HouseholdFactor,
    HouseholdGeographicFactorV1 Geography,
    RialAmount BaseAmount,
    RialAmount Ceiling,
    HouseholdAllocationResult Allocation);

/// <summary>
/// Composes the versioned qualitative household mapping, geography dataset,
/// and needs-based formula into one deterministic quote. It assumes city and
/// province names were validated by the canonical geography registry.
/// </summary>
public static class NeedsBasedHouseholdQuoteCalculatorV1
{
    public const string FormulaVersion = "HANA-NEEDS-BASED-ALLOCATION-v1.1";

    public static NeedsBasedHouseholdQuoteV1 ForCity(
        RialAmount baseAmount,
        RialAmount ceiling,
        string provinceName,
        string cityName,
        HouseholdNeedAssessmentInput assessment)
    {
        var geography = GeographicAllocationDatasetV1.ForCity(provinceName, cityName);
        return Calculate(baseAmount, ceiling, geography, assessment);
    }

    public static NeedsBasedHouseholdQuoteV1 ForNonCity(
        RialAmount baseAmount,
        RialAmount ceiling,
        string provinceName,
        HouseholdNeedAssessmentInput assessment)
    {
        var geography = GeographicAllocationDatasetV1.ForNonCity(provinceName);
        return Calculate(baseAmount, ceiling, geography, assessment);
    }

    private static NeedsBasedHouseholdQuoteV1 Calculate(
        RialAmount baseAmount,
        RialAmount ceiling,
        HouseholdGeographicFactorV1 geography,
        HouseholdNeedAssessmentInput assessment)
    {
        ArgumentNullException.ThrowIfNull(assessment);

        var scores = HouseholdNeedScoringV1.Map(assessment);
        var householdFactor = NeedsBasedAllocationV1.CalculateHouseholdFactor(scores);
        var allocation = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount, ceiling, geography.Factor, scores);

        return new NeedsBasedHouseholdQuoteV1(
            FormulaVersion,
            HouseholdNeedScoringV1.Version,
            geography.DatasetVersion,
            scores,
            householdFactor,
            geography,
            baseAmount,
            ceiling,
            allocation);
    }
}
