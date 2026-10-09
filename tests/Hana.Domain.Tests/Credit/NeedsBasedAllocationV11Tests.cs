using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class NeedsBasedAllocationV11Tests
{
    private static HouseholdSevenFactorAssessmentV11 Case(
        HouseholdHousingTenure tenure, HouseholdNeedScores? scores = null,
        decimal geography = 1m, Guid? householdId = null,
        Guid? snapshotId = null)
    {
        var snapshot = snapshotId ?? Guid.NewGuid();
        return new(householdId ?? Guid.NewGuid(), snapshot,
            scores ?? new HouseholdNeedScores(0, 0, 0, 0, 0, 0),
            new HouseholdHousingTenureEvidence(snapshot, tenure,
                "reviewed-housing-tenure-evidence"),
            "non-housing-hardship-reviewed-evidence", geography);
    }

    [Fact]
    public void ApprovedSevenWeightsAreCompleteAndVersioned()
    {
        Assert.Equal(1m, NeedsBasedAllocationV11.HealthWeight +
            NeedsBasedAllocationV11.NonHousingHardshipWeight +
            NeedsBasedAllocationV11.AgeAndDependencyWeight +
            NeedsBasedAllocationV11.HouseholdSizeWeight +
            NeedsBasedAllocationV11.CareAndSupportWeight +
            NeedsBasedAllocationV11.EducationWeight +
            NeedsBasedAllocationV11.HousingTenureWeight);
        Assert.Equal(.30m, NeedsBasedAllocationV11.HealthWeight);
        Assert.Equal(.20m, NeedsBasedAllocationV11.NonHousingHardshipWeight);
        Assert.Equal(.15m, NeedsBasedAllocationV11.AgeAndDependencyWeight);
        Assert.Equal(.10m, NeedsBasedAllocationV11.HouseholdSizeWeight);
        Assert.Equal(.10m, NeedsBasedAllocationV11.CareAndSupportWeight);
        Assert.Equal(.05m, NeedsBasedAllocationV11.EducationWeight);
        Assert.Equal(.10m, NeedsBasedAllocationV11.HousingTenureWeight);
        Assert.Equal("HANA-NEEDS-BASED-ALLOCATION-v1.1",
            NeedsBasedAllocationV11.FormulaVersion);
    }

    [Fact]
    public void OwnerZeroAndTenantTwoOfThreeAreExplicitNotMissingDefaults()
    {
        Assert.Equal(0, NeedsBasedAllocationV11.ScoreHousing(HouseholdHousingTenure.Owner));
        Assert.Equal(2, NeedsBasedAllocationV11.ScoreHousing(HouseholdHousingTenure.Tenant));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            NeedsBasedAllocationV11.ScoreHousing((HouseholdHousingTenure)0));

        var owner = Case(HouseholdHousingTenure.Owner);
        var tenant = Case(HouseholdHousingTenure.Tenant);
        Assert.Equal(1m, NeedsBasedAllocationV11.CalculateHouseholdFactor(owner));
        Assert.Equal(1m + .5m * (.10m * 2m) / 3m,
            NeedsBasedAllocationV11.CalculateHouseholdFactor(tenant));
        var allScored = Case(HouseholdHousingTenure.Tenant,
            new HouseholdNeedScores(3, 3, 3, 3, 3, 3));
        Assert.Equal(1m + .5m * (.90m * 3m + .10m * 2m) / 3m,
            NeedsBasedAllocationV11.CalculateHouseholdFactor(allScored));
    }

    [Fact]
    public void HousingAndNonHousingHardshipRequireEvidenceAndExactSnapshot()
    {
        var snapshot = Guid.NewGuid();
        var evidence = new HouseholdHousingTenureEvidence(snapshot,
            HouseholdHousingTenure.Tenant, "tenure-review");
        var noNeeds = new HouseholdNeedScores(0, 0, 0, 0, 0, 0);
        Assert.Throws<ArgumentException>(() => new HouseholdSevenFactorAssessmentV11(
            Guid.NewGuid(), Guid.NewGuid(), noNeeds, evidence,
            "non-housing-hardship-review", 1m));
        Assert.Throws<ArgumentException>(() => new HouseholdSevenFactorAssessmentV11(
            Guid.NewGuid(), snapshot, noNeeds, evidence, "", 1m));
        Assert.Throws<ArgumentException>(() => new HouseholdSevenFactorAssessmentV11(
            Guid.NewGuid(), snapshot, noNeeds, evidence,
            "non-housing-hardship-review", 0m));
        Assert.Throws<ArgumentException>(() => new HouseholdSevenFactorAssessmentV11(
            Guid.NewGuid(), snapshot, noNeeds, null!, "hardship", 1m));
    }

    [Fact]
    public void SeparateV11PoolPreviewPreservesGeographyFloorAndHistory()
    {
        var first = Case(HouseholdHousingTenure.Owner,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0), .8m);
        var second = Case(HouseholdHousingTenure.Tenant,
            new HouseholdNeedScores(0, 3, 0, 0, 0, 0), 1.2m);
        var before = NeedsBasedAllocationV1.CalculateHouseholdFactor(first.SixScores);
        var result = NeedsBasedAllocationV11.PreviewPool(10000L, new[] { first, second });
        var weights = new[]
        {
            NeedsBasedAllocationV11.CalculateHouseholdFactor(first) * first.GeographicFactor,
            NeedsBasedAllocationV11.CalculateHouseholdFactor(second) * second.GeographicFactor
        };
        var total = weights.Sum();
        Assert.Equal(checked((long)decimal.Floor(10000m * weights[0] / total)),
            result.Rows[0].AllocatedRial);
        Assert.Equal(checked((long)decimal.Floor(10000m * weights[1] / total)),
            result.Rows[1].AllocatedRial);
        Assert.Equal(10000L, result.Rows.Sum(x => x.AllocatedRial) + result.UnallocatedRial);
        Assert.Equal(0, result.Rows[0].HousingScore);
        Assert.Equal(2, result.Rows[1].HousingScore);
        Assert.Equal(.8m, result.Rows[0].GeographicFactor);
        Assert.Equal(1.2m, result.Rows[1].GeographicFactor);
        Assert.Equal(NeedsBasedAllocationV11.FormulaVersion, result.FormulaVersion);
        Assert.Equal(NeedsBasedAllocationV11.ScoringVersion, result.ScoringVersion);
        // The separate six-factor historical baseline remains byte-for-byte
        // governed by its original version and unchanged calculation.
        Assert.Equal(before,
            NeedsBasedAllocationV1.CalculateHouseholdFactor(first.SixScores));
        Assert.Equal("henna-learning-baseline-v1",
            AllocationWeightProfile.Baseline.Version);
    }

    [Fact]
    public void MissingAndDuplicateInputsDoNotGetASevenFactorAllocation()
    {
        var a = Case(HouseholdHousingTenure.Tenant);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            NeedsBasedAllocationV11.PreviewPool(0, new[] { a }));
        Assert.Throws<ArgumentException>(() =>
            NeedsBasedAllocationV11.PreviewPool(10, Array.Empty<HouseholdSevenFactorAssessmentV11>()));
        Assert.Throws<ArgumentException>(() =>
            NeedsBasedAllocationV11.PreviewPool(10, new[] { a, a }));
        var b = Case(HouseholdHousingTenure.Owner,
            householdId: a.HouseholdKey);
        Assert.Throws<ArgumentException>(() =>
            NeedsBasedAllocationV11.PreviewPool(10, new[] { a, b }));
    }
}
