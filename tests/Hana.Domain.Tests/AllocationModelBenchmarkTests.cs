using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests;

public sealed class AllocationModelBenchmarkTests
{
    [Fact]
    public void EvaluationPartitionProducesCandidateIndependentBenchmarkFingerprint()
    {
        var cutoff = new DateTimeOffset(
            2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var rubric = "benchmark-rubric-v1";
        var reviewer = Guid.NewGuid();
        var examples = new[]
        {
            new ReviewedNeedExample(
                Guid.NewGuid(),
                new HouseholdNeedScores(3,0,0,0,0,0),
                .35m,
                reviewer,
                rubric,
                cutoff.AddHours(-2),
                LearningPartition.Evaluation),
            new ReviewedNeedExample(
                Guid.NewGuid(),
                new HouseholdNeedScores(0,3,0,0,0,0),
                .20m,
                reviewer,
                rubric,
                cutoff.AddHours(-1),
                LearningPartition.Evaluation)
        };
        var candidateA = new AllocationWeightProfile(
            "benchmark-candidate-a", .35m,.20m,.18m,.12m,.10m,.05m);
        var candidateB = new AllocationWeightProfile(
            "benchmark-candidate-b", .34m,.21m,.18m,.12m,.10m,.05m);

        var a = AllocationModelBenchmarkEvaluator.Evaluate(
            examples,
            AllocationWeightProfile.Baseline,
            candidateA,
            cutoff);
        var b = AllocationModelBenchmarkEvaluator.Evaluate(
            examples,
            AllocationWeightProfile.Baseline,
            candidateB,
            cutoff);

        Assert.Equal(2, a.EvaluationCount);
        Assert.Equal(0m, a.CandidateMse);
        Assert.True(a.BaselineMse > a.CandidateMse);
        Assert.Equal(
            a.EvaluationFingerprint,
            b.EvaluationFingerprint);
        Assert.NotEqual(a.CandidateMse, b.CandidateMse);
        Assert.Equal(rubric, a.RubricVersion);
        Assert.NotNull(a.BaselineDiagnostics);
        Assert.NotNull(a.CandidateDiagnostics);
        Assert.Equal(2, a.CandidateDiagnostics!.Count);
        Assert.Equal(0d, a.CandidateDiagnostics.Mse, 12);
        Assert.Equal(0d, a.CandidateDiagnostics.Rmse, 12);
        Assert.Equal(0d, a.CandidateDiagnostics.Mae, 12);
        Assert.Equal(0d, a.CandidateDiagnostics.MeanResidual, 12);
        Assert.Equal(1d, a.CandidateDiagnostics.CalibrationSlope!.Value, 12);
        Assert.Equal(0d, a.CandidateDiagnostics.CalibrationIntercept!.Value, 12);
    }

    [Fact]
    public void RegressionDiagnosticsLeaveCalibrationUndefinedForConstantPredictions()
    {
        var metrics = RegressionDiagnosticEvaluator.Evaluate(
            new[] { .2d, .8d },
            new[] { .5d, .5d });

        Assert.Equal(2, metrics.Count);
        Assert.Null(metrics.CalibrationSlope);
        Assert.Null(metrics.CalibrationIntercept);
        Assert.Equal(.09d, metrics.Mse, 12);
        Assert.Equal(.3d, metrics.Rmse, 12);
        Assert.Equal(.3d, metrics.Mae, 12);
        Assert.Equal(0d, metrics.MeanResidual, 12);
    }

    [Fact]
    public void TrainingOrValidationRowsCannotMasqueradeAsIndependentEvaluation()
    {
        var cutoff = new DateTimeOffset(
            2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var row = new ReviewedNeedExample(
            Guid.NewGuid(),
            new HouseholdNeedScores(1,1,1,1,1,1),
            .5m,
            Guid.NewGuid(),
            "benchmark-rubric",
            cutoff.AddHours(-1),
            LearningPartition.Validation);

        Assert.Throws<ArgumentException>(() =>
            AllocationModelBenchmarkEvaluator.Evaluate(
                new[] { row },
                AllocationWeightProfile.Baseline,
                new AllocationWeightProfile(
                    "benchmark-candidate",
                    .31m,.24m,.18m,.12m,.10m,.05m),
                cutoff));
    }
}
