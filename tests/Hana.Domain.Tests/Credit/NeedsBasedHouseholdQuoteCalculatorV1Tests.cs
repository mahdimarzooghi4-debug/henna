using Hana.Domain.Credit;
using Hana.Domain.Money;

namespace Hana.Domain.Tests;

public sealed class NeedsBasedHouseholdQuoteCalculatorV1Tests
{
    [Fact]
    public void CityQuoteComposesVersionedGeographyHouseholdScoresAndFormula()
    {
        var assessment = MinimumAssessment(householdSize: 1,
            new HouseholdAgeComposition(0, 0, 0, 1, 0, 0));

        var quote = NeedsBasedHouseholdQuoteCalculatorV1.ForCity(
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            "زنجان",
            assessment);

        Assert.Equal("HANA-NEEDS-BASED-ALLOCATION-v1.1", quote.FormulaVersion);
        Assert.Equal(HouseholdNeedScoringV1.Version, quote.HouseholdScoringVersion);
        Assert.Equal(GeographicAllocationDatasetV1.Version, quote.GeographyDatasetVersion);
        Assert.Equal(quote.Geography.Factor, quote.Allocation.GeographicFactor);
        Assert.Equal(quote.HouseholdFactor, quote.Allocation.HouseholdFactor);
        Assert.Equal(new RialAmount((long)decimal.Floor(
            quote.BaseAmount.Value * quote.Geography.Factor)),
            quote.Allocation.CalculatedAmount);
    }

    [Fact]
    public void CapitalAndOtherCityUseTheirOwnGeographicFactors()
    {
        var assessment = MinimumAssessment(householdSize: 1,
            new HouseholdAgeComposition(0, 0, 0, 1, 0, 0));

        var capital = NeedsBasedHouseholdQuoteCalculatorV1.ForCity(
            new RialAmount(10_000_000), new RialAmount(10_000_000),
            "زنجان", "زنجان", assessment);
        var otherCity = NeedsBasedHouseholdQuoteCalculatorV1.ForCity(
            new RialAmount(10_000_000), new RialAmount(10_000_000),
            "زنجان", "ابهر", assessment);

        Assert.True(capital.Geography.IsProvincialCapital);
        Assert.False(otherCity.Geography.IsProvincialCapital);
        Assert.Equal(capital.Geography.BaseFactor * 1.20m, capital.Geography.Factor);
        Assert.Equal(otherCity.Geography.BaseFactor, otherCity.Geography.Factor);
        Assert.True(capital.Allocation.CalculatedAmount.Value >
            otherCity.Allocation.CalculatedAmount.Value);
    }

    [Fact]
    public void NonCityQuoteUsesRuralMpi()
    {
        var assessment = MinimumAssessment(householdSize: 1,
            new HouseholdAgeComposition(0, 0, 0, 1, 0, 0));

        var quote = NeedsBasedHouseholdQuoteCalculatorV1.ForNonCity(
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            assessment);

        Assert.False(quote.Geography.IsUrban);
        Assert.Equal(0.015836m, quote.Geography.RawMpi);
        Assert.False(quote.Geography.IsProvincialCapital);
        Assert.Equal(quote.Geography.Factor, quote.Allocation.GeographicFactor);
    }

    [Fact]
    public void MissingQualitativeAssessmentFailsInsteadOfUsingZeroScores()
    {
        Assert.Throws<InvalidOperationException>(() =>
            NeedsBasedHouseholdQuoteCalculatorV1.ForCity(
                new RialAmount(10), new RialAmount(10),
                "زنجان", "زنجان", new HouseholdNeedAssessmentInput()));
    }

    private static HouseholdNeedAssessmentInput MinimumAssessment(
        int householdSize,
        HouseholdAgeComposition ageComposition) => new()
    {
        HealthBurden = HealthBurdenLevel.NoOngoingTreatment,
        EconomicHardship = EconomicHardshipLevel.EssentialNeedsGenerallyMet,
        CareAndSupport = CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
        Education = EducationAttainment.BachelorOrHigher,
        HousingTenure = HousingTenureType.Owner,
        HouseholdSize = householdSize,
        AgeComposition = ageComposition
    };
}
