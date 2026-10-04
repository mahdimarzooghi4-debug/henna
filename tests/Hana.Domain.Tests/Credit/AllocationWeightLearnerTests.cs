using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class AllocationWeightLearnerTests
{
    private static readonly DateTimeOffset Cutoff = new(2026, 10, 4, 0, 0, 0, TimeSpan.Zero);
    private static ReviewedNeedExample[] Examples(bool useBaseline = false) => Enumerable.Range(0, 48).Select(i =>
    {
        var feature = i % 6;
        var values = Enumerable.Range(0, 6).Select(k => k == feature ? 3 : 0).ToArray();
        var target = useBaseline ? new[] { .30m, .25m, .18m, .12m, .10m, .05m }[feature]
            : new[] { .35m, .20m, .18m, .12m, .10m, .05m }[feature];
        return new ReviewedNeedExample(new Guid(i + 1, 0, 0, new byte[8]),
            new(values[0], values[1], values[2], values[3], values[4], values[5]), target,
            new Guid(999, 0, 0, new byte[8]), "synthetic-reviewed-rubric-v1", Cutoff.AddDays(-1),
            i < 36 ? LearningPartition.Training : LearningPartition.Validation);
    }).ToArray();

    [Fact]
    public void LearnsBoundedWeightsAndImprovesOnUnseenHouseholds()
    {
        var result = ExperimentalAllocationWeightLearner.Train(Examples(), AllocationWeightProfile.Baseline, Cutoff);
        Assert.Equal(.35m, result.Candidate.Health);
        Assert.Equal(.20m, result.Candidate.Hardship);
        Assert.Equal(0m, result.Metrics.CandidateValidationMse);
        Assert.True(result.Metrics.BaselineValidationMse > 0m);
        Assert.Equal(36, result.Metrics.TrainingCount);
        Assert.Equal(12, result.Metrics.ValidationCount);
        var repeated = ExperimentalAllocationWeightLearner.Train(Examples().Reverse().ToArray(),
            AllocationWeightProfile.Baseline, Cutoff);
        Assert.Equal(result, repeated);
    }

    [Fact]
    public void ValidationLabelsDoNotChooseFittedWeights()
    {
        var data = Examples();
        var original = ExperimentalAllocationWeightLearner.Train(data, AllocationWeightProfile.Baseline, Cutoff);
        var changed = data.Select(x => x.Partition == LearningPartition.Validation
            ? x with { ReviewedNeedScore = x.ReviewedNeedScore * .999m } : x).ToArray();
        var result = ExperimentalAllocationWeightLearner.Train(changed, AllocationWeightProfile.Baseline, Cutoff);
        Assert.Equal(original.Candidate.Health, result.Candidate.Health);
        Assert.Equal(original.Candidate.Hardship, result.Candidate.Hardship);
    }

    [Fact]
    public void RejectsNoImprovementLeakageAndFutureReviews()
    {
        Assert.Throws<InvalidOperationException>(() => ExperimentalAllocationWeightLearner.Train(
            Examples(true), AllocationWeightProfile.Baseline, Cutoff));
        var data = Examples(); data[47] = data[47] with { HouseholdKey = data[0].HouseholdKey };
        Assert.Throws<ArgumentException>(() => ExperimentalAllocationWeightLearner.Train(data,
            AllocationWeightProfile.Baseline, Cutoff));
        data = Examples(); data[0] = data[0] with { ReviewedAtUtc = Cutoff.AddDays(1) };
        Assert.Throws<ArgumentException>(() => ExperimentalAllocationWeightLearner.Train(data,
            AllocationWeightProfile.Baseline, Cutoff));
    }
}
