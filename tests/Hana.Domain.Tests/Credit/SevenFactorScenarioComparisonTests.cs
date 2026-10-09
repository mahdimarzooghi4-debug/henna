using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class SevenFactorScenarioComparisonTests
{
    private static SevenFactorGeographyScenarioCase Case(
        HouseholdHousingTenure tenure, HouseholdNeedScores scores,
        decimal mpi, bool capital = false, Guid? household = null,
        Guid? snapshot = null, string dataset = "signed-reviewed-mpi-v1")
    {
        var id = snapshot ?? Guid.NewGuid();
        var geo = NeedsBasedAllocationV1.CalculateGeographicFactor(
            mpi, .2m, .8m, capital);
        var assessed = new HouseholdSevenFactorAssessmentV11(
            household ?? Guid.NewGuid(), id, scores,
            new HouseholdHousingTenureEvidence(id, tenure, "reviewed-housing"),
            "reviewed-non-housing-hardship", geo);
        return new SevenFactorGeographyScenarioCase(
            assessed, dataset, mpi, .2m, .8m, capital);
    }

    private static SevenFactorCoefficientDraft Candidate() =>
        new("research-seven-weights-v2",
            .25m, .25m, .15m, .10m, .10m, .05m, .10m);

    [Fact]
    public void CoefficientOnlySimulationPreservesGAndExactSourcePool()
    {
        var a = Case(HouseholdHousingTenure.Owner,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0), .2m);
        var b = Case(HouseholdHousingTenure.Tenant,
            new HouseholdNeedScores(0, 3, 0, 0, 0, 0), .8m, true);
        var result = SevenFactorScenarioComparison.ComparePool(
            10001L, new[] { a, b }, Candidate(), "henna-program:research-only");

        Assert.Equal(NeedsBasedAllocationV11.FormulaVersion,
            result.BaselineFormulaVersion);
        Assert.Equal("signed-reviewed-mpi-v1",
            result.BaselineGeographyDatasetVersion);
        Assert.Equal(result.BaselineGeographyDatasetVersion,
            result.CandidateGeographyVersion);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal(a.Assessment.GeographicFactor,
            result.Rows[0].CandidateGeographicFactor);
        Assert.Equal(b.Assessment.GeographicFactor,
            result.Rows[1].CandidateGeographicFactor);

        // Approved v1.1 baseline is unchanged even under a hypothetical
        // coefficient candidate: match the existing baseline preview exactly.
        var baseline = NeedsBasedAllocationV11.PreviewPool(
            result.PoolRial, new[] { a.Assessment, b.Assessment });
        Assert.Equal(baseline.Rows[0].AllocatedRial,
            result.Rows[0].BaselineAmountRial);
        Assert.Equal(baseline.Rows[1].AllocatedRial,
            result.Rows[1].BaselineAmountRial);
        Assert.Equal(baseline.UnallocatedRial,
            result.BaselineUnallocatedRial);

        var expectedSum = result.Rows.Sum(x => x.CandidateAmountRial) +
            result.CandidateUnallocatedRial;
        Assert.Equal(result.PoolRial, expectedSum);
        Assert.Equal(result.PoolRial,
            result.Rows.Sum(x => x.BaselineAmountRial) +
                result.BaselineUnallocatedRial);
        Assert.NotEqual(result.Rows[0].BaselineHouseholdFactor,
            result.Rows[0].CandidateHouseholdFactor);
    }

    [Fact]
    public void GeographyProposalIsAnIndependentVersionedResearchScenario()
    {
        var a = Case(HouseholdHousingTenure.Owner,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0), .2m);
        var b = Case(HouseholdHousingTenure.Tenant,
            new HouseholdNeedScores(0, 3, 0, 0, 0, 0), .8m, true);
        var proposal = new GeographyParameterResearchDraft(
            "geographic-research-only-v2", "signed-reviewed-mpi-v1",
            Guid.NewGuid(), Guid.NewGuid(), .9m, 1.1m, 1.1m);
        var x = SevenFactorScenarioComparison.ComparePool(
            10001L, new[] { a, b }, Candidate(),
            "henna-program:research-only", proposal);

        Assert.Equal(proposal.Version, x.CandidateGeographyVersion);
        Assert.Equal(.9m, x.Rows[0].CandidateGeographicFactor);
        Assert.Equal(1.21m, x.Rows[1].CandidateGeographicFactor);
        Assert.NotEqual(x.Rows[0].BaselineGeographicFactor,
            x.Rows[0].CandidateGeographicFactor);
        Assert.Equal(x.PoolRial,
            x.Rows.Sum(z => z.CandidateAmountRial) + x.CandidateUnallocatedRial);
        Assert.Equal(x.PoolRial,
            x.Rows.Sum(z => z.BaselineAmountRial) + x.BaselineUnallocatedRial);
        Assert.Throws<ArgumentException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                10001L, new[] { a, b }, Candidate(), "henna-program:research-only",
                new GeographyParameterResearchDraft(
                    "wrong-dataset", "a-different-geography-version",
                    Guid.NewGuid(), Guid.NewGuid(), .9m, 1.1m, 1.1m)));
    }

    [Fact]
    public void StaleOrMixedInputsDoNotBecomeAResearchComparison()
    {
        var a = Case(HouseholdHousingTenure.Owner,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0), .3m);
        Assert.Throws<ArgumentException>(() =>
            new SevenFactorGeographyScenarioCase(
                a.Assessment, a.GeographyDatasetVersion,
                .4m, .2m, .8m, false));
        Assert.Throws<ArgumentException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                100L, new[] { a, a }, Candidate(), "henna-program:research-only"));
        Assert.Throws<ArgumentException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                100L, new[] { a,
                    Case(HouseholdHousingTenure.Tenant,
                        new HouseholdNeedScores(0, 3, 0, 0, 0, 0), .7m,
                        dataset: "other-geography") },
                Candidate(), "henna-program:research-only"));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                0L, new[] { a }, Candidate(), "henna-program:research-only"));
        Assert.Throws<ArgumentException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                100L, new[] { a }, Candidate(), ""));
        Assert.Throws<ArgumentException>(() =>
            SevenFactorScenarioComparison.ComparePool(
                100L, new[] { a },
                new SevenFactorCoefficientDraft(
                    NeedsBasedAllocationV11.FormulaVersion,
                    .30m, .20m, .15m, .10m, .10m, .05m, .10m),
                "henna-program:research-only"));
    }
}
