using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class AllocationLearningTests
{
    [Fact]
    public void BaselineMatchesExistingFormula()
    {
        var scores = new HouseholdNeedScores(3, 2, 1, 2, 0, 1);
        Assert.Equal(NeedsBasedAllocationV1.CalculateHouseholdFactor(scores),
            AllocationWeightProfile.Baseline.Factor(scores));
    }

    [Fact]
    public void SimulationRedistributesOnlyWithinFixedPool()
    {
        var cases = new[] {
            new AllocationLearningCase(Guid.NewGuid(), new(3, 0, 0, 0, 0, 0), 1m),
            new AllocationLearningCase(Guid.NewGuid(), new(0, 3, 0, 0, 0, 0), 1m) };
        var candidate = new AllocationWeightProfile("candidate-1", .25m, .30m, .18m, .12m, .10m, .05m);
        var result = AllocationLearningSimulator.ComparePool(1000000m, cases,
            AllocationWeightProfile.Baseline, candidate, "data-1", "instruction-1");
        Assert.InRange(result.Rows.Sum(r => r.ProposedAmountRial), 999999.999999m, 1000000.000001m);
        Assert.True(result.Rows[0].ChangeRial < 0m);
        Assert.True(result.Rows[1].ChangeRial > 0m);
        Assert.Equal("data-1", result.DatasetVersion);
    }

    [Fact]
    public void InvalidWeightsAndDuplicateHouseholdsAreRejected()
    {
        Assert.Throws<ArgumentException>(() => new AllocationWeightProfile("bad", 1m, 1m, 0m, 0m, 0m, 0m));
        var item = new AllocationLearningCase(Guid.NewGuid(), new(0, 0, 0, 0, 0, 0), 1m);
        var candidate = new AllocationWeightProfile("candidate", .30m, .25m, .18m, .12m, .10m, .05m);
        Assert.Throws<ArgumentException>(() => AllocationLearningSimulator.ComparePool(10m,
            new[] { item, item }, AllocationWeightProfile.Baseline, candidate, "data", "instruction"));
    }
}
