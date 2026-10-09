using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using XGBoostSharp;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class HennaXGBoostOfflineLearnerTests
{
    [Fact]
    public void TrainsReloadableCpuArtifactFromTrainingOnly()
    {
        var cutoff = new DateTimeOffset(
            2026, 10, 7, 6, 0, 0, TimeSpan.Zero);
        var reviewer = Guid.NewGuid();
        var labels = new[] { .35m, .20m, .18m, .12m, .10m, .05m };
        var examples = Enumerable.Range(0, 48).Select(i =>
        {
            var scores = Enumerable.Range(0, 6)
                .Select(k => k == i % 6 ? 3 : 0).ToArray();
            return new ReviewedNeedExample(
                Guid.NewGuid(),
                new HouseholdNeedScores(
                    scores[0], scores[1], scores[2],
                    scores[3], scores[4], scores[5]),
                labels[i % 6],
                reviewer,
                "xgboost-ci-rubric-v1",
                cutoff.AddMinutes(-i - 1),
                i < 36
                    ? LearningPartition.Training
                    : LearningPartition.Validation);
        }).ToArray();

        var artifact = HennaXGBoostOfflineLearner.Train(
            examples, cutoff);

        Assert.Equal(
            HennaXGBoostOfflineLearner.ModelVersion,
            artifact.ModelVersion);
        Assert.Equal(
            HennaXGBoostOfflineLearner.ArtifactFormat,
            artifact.ArtifactFormat);
        Assert.NotEmpty(artifact.ArtifactBytes);
        Assert.Equal(
            Convert.ToHexString(SHA256.HashData(artifact.ArtifactBytes))
                .ToLowerInvariant(),
            artifact.ArtifactSha256);
        Assert.Equal(64, artifact.ArtifactSha256.Length);
        Assert.Equal(36, artifact.Metrics.TrainingCount);
        Assert.Equal(12, artifact.Metrics.ValidationCount);
        Assert.True(double.IsFinite(artifact.Metrics.TrainingMse));
        Assert.True(double.IsFinite(artifact.Metrics.ValidationMse));
        Assert.Contains("\"booster\":\"gbtree\"", artifact.ParametersJson);
        Assert.Contains("\"treeMethod\":\"hist\"", artifact.ParametersJson);

        using var reloaded = XGBRegressor.LoadFromByteArray(
            artifact.ArtifactBytes);
        var prediction = reloaded.Predict(new[]
        {
            new[] { 3f, 0f, 0f, 0f, 0f, 0f }
        });
        Assert.Single(prediction);
        Assert.True(float.IsFinite(prediction[0]));
    }

    [Fact]
    public void RefusesEvaluationPartition()
    {
        var cutoff = new DateTimeOffset(
            2026, 10, 7, 6, 0, 0, TimeSpan.Zero);
        var reviewer = Guid.NewGuid();
        var examples = Enumerable.Range(0, 40).Select(i =>
            new ReviewedNeedExample(
                Guid.NewGuid(),
                new HouseholdNeedScores(1, 1, 1, 1, 1, 1),
                .5m,
                reviewer,
                "xgboost-ci-rubric-v1",
                cutoff.AddMinutes(-i - 1),
                i == 0
                    ? LearningPartition.Evaluation
                    : i < 30
                        ? LearningPartition.Training
                        : LearningPartition.Validation))
            .ToArray();

        Assert.Throws<ArgumentException>(() =>
            HennaXGBoostOfflineLearner.Train(examples, cutoff));
    }
}
