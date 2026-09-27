using Hana.Domain.Credit;

namespace Hana.Domain.Tests;

public sealed class HouseholdNeedScoringV1Tests
{
    private static HouseholdNeedAssessmentInput Input(int size, HouseholdAgeComposition ages) => new()
    {
        HealthBurden = HealthBurdenLevel.NoOngoingTreatment,
        EconomicHardship = EconomicHardshipLevel.EssentialNeedsGenerallyMet,
        CareAndSupport = CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
        Education = EducationAttainment.BachelorOrHigher,
        HouseholdSize = size,
        AgeComposition = ages
    };

    [Theory]
    [InlineData(1, 0)]
    [InlineData(2, 0.5)]
    [InlineData(3, 1)]
    [InlineData(4, 1.5)]
    [InlineData(5, 2)]
    [InlineData(6, 2.5)]
    [InlineData(7, 3)]
    public void MapsHouseholdSizeBands(int size, decimal expected)
    {
        var scores = HouseholdNeedScoringV1.Map(Input(size,
            new HouseholdAgeComposition(0, 0, 0, size, 0, 0)));
        Assert.Equal(expected, scores.HouseholdSize);
    }

    [Fact]
    public void MapsAgePointsAndCapsAtThree()
    {
        var normal = HouseholdNeedScoringV1.Map(Input(3,
            new HouseholdAgeComposition(1, 1, 1, 0, 0, 0)));
        Assert.Equal(2.25m, normal.AgeAndDependency);

        var capped = HouseholdNeedScoringV1.Map(Input(4,
            new HouseholdAgeComposition(4, 0, 0, 0, 0, 0)));
        Assert.Equal(3m, capped.AgeAndDependency);
    }

    [Fact]
    public void AgeAloneDoesNotScoreForOlderAdultsWithoutPracticalSupportNeeds()
    {
        var noNeed = HouseholdNeedScoringV1.Map(Input(1,
            new HouseholdAgeComposition(0, 0, 0, 0, 1, 0)));
        var needsSupport = HouseholdNeedScoringV1.Map(Input(1,
            new HouseholdAgeComposition(0, 0, 0, 0, 1, 1)));

        Assert.Equal(0m, noNeed.AgeAndDependency);
        Assert.Equal(0.75m, needsSupport.AgeAndDependency);
    }

    [Fact]
    public void MapsHealthHardshipCareAndEducationCategories()
    {
        var scores = HouseholdNeedScoringV1.Map(new HouseholdNeedAssessmentInput
        {
            HealthBurden = HealthBurdenLevel.SevereOngoingCareOrMultipleHighBurdenCases,
            EconomicHardship = EconomicHardshipLevel.MultipleEssentialNeedsUnmetOrSevereInstability,
            CareAndSupport = CareSupportLevel.NoPracticalSupportWithMultipleDependentsOrHighCareBurden,
            Education = EducationAttainment.NoLiteracyOrFormalEducation,
            HouseholdSize = 1,
            AgeComposition = new HouseholdAgeComposition(0, 0, 0, 1, 0, 0)
        });
        Assert.Equal(3, scores.Health);
        Assert.Equal(3, scores.EconomicHardship);
        Assert.Equal(3, scores.CareAndSupport);
        Assert.Equal(3, scores.Education);
        Assert.Equal(0m, scores.HouseholdSize);
    }

    [Fact]
    public void MissingValuesAreNotTreatedAsZero()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            HouseholdNeedScoringV1.Map(new HouseholdNeedAssessmentInput()));
        Assert.Contains(nameof(HouseholdNeedAssessmentInput.HealthBurden), error.Message);
        Assert.Contains(nameof(HouseholdNeedAssessmentInput.AgeComposition), error.Message);
    }

    [Fact]
    public void AgeGroupsMustAccountForAllHouseholdMembers()
    {
        Assert.Throws<ArgumentException>(() => HouseholdNeedScoringV1.Map(Input(2,
            new HouseholdAgeComposition(0, 0, 0, 1, 0, 0))));
    }

    [Fact]
    public void RejectsNegativeAgeCountsAndUnknownEnumValues()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new HouseholdAgeComposition(-1, 0, 0, 0, 0, 0));

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            HouseholdNeedScoringV1.Map(new HouseholdNeedAssessmentInput
            {
                HealthBurden = (HealthBurdenLevel)99,
                EconomicHardship = EconomicHardshipLevel.EssentialNeedsGenerallyMet,
                CareAndSupport = CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
                Education = EducationAttainment.BachelorOrHigher,
                HouseholdSize = 1,
                AgeComposition = new HouseholdAgeComposition(0, 0, 0, 1, 0, 0)
            }));
    }

    [Fact]
    public void ExposesVersion()
    {
        Assert.Equal("1.0", HouseholdNeedScoringV1.Version);
    }
}
