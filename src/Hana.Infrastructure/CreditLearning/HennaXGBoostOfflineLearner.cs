using System.Security.Cryptography;
using System.Text.Json;
using Hana.Domain.Credit;
using XGBoostSharp;

namespace Hana.Infrastructure.CreditLearning;

public sealed record HennaXGBoostOfflineMetrics(
    int TrainingCount,
    int ValidationCount,
    double TrainingMse,
    double ValidationMse,
    string RubricVersion);

public sealed record HennaXGBoostOfflineArtifact(
    string ModelVersion,
    string ArtifactFormat,
    string ArtifactSha256,
    byte[] ArtifactBytes,
    string ParametersJson,
    HennaXGBoostOfflineMetrics Metrics);

/// <summary>
/// Henna-owned, CPU-only XGBoost shadow learner. It trains only on reviewed
/// first-party Training rows, evaluates only on held-out Validation rows and
/// cannot create proposals, eligibility decisions or runtime activations.
/// </summary>
public static class HennaXGBoostOfflineLearner
{
    public const string ModelVersion = "henna-xgboost-v1-offline";
    public const string ArtifactFormat = "xgboost-json";

    public static HennaXGBoostOfflineArtifact Train(
        IReadOnlyList<ReviewedNeedExample> examples,
        DateTimeOffset cutoffUtc,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(examples);
        if (cutoffUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("UTC cutoff required.");

        var data = examples.OrderBy(x => x?.HouseholdKey).ToArray();
        if (data.Length > 500 ||
            data.Any(x => x is null || x.HouseholdKey == Guid.Empty ||
                x.ReviewerKey == Guid.Empty || x.Scores is null ||
                x.ReviewedNeedScore is < 0m or > 1m ||
                string.IsNullOrWhiteSpace(x.RubricVersion) ||
                x.RubricVersion.Length > 120 ||
                x.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                x.ReviewedAtUtc > cutoffUtc ||
                x.Partition == LearningPartition.Evaluation ||
                !Enum.IsDefined(x.Partition)) ||
            data.Select(x => x.HouseholdKey).Distinct().Count() != data.Length)
            throw new ArgumentException(
                "Complete, distinct reviewed training/validation households are required.");
        if (data.Select(x => x.RubricVersion).Distinct().Count() != 1)
            throw new ArgumentException("One reviewed scoring rubric is required.");
        AllocationRubricFoundationBoundary.RejectNonLabelingFoundation(data.FirstOrDefault()?.RubricVersion);

        var training = data.Where(x => x.Partition == LearningPartition.Training).ToArray();
        var validation = data.Where(x => x.Partition == LearningPartition.Validation).ToArray();
        if (training.Length < 30 || validation.Length < 10)
            throw new ArgumentException(
                "At least 30 training and 10 held-out validation households are required.");

        cancellationToken.ThrowIfCancellationRequested();
        const int nEstimators = 100;
        const int maxDepth = 3;
        const float learningRate = 0.1f;
        const int seed = 0;
        const int nThread = 1;

        var parametersJson = JsonSerializer.Serialize(new
        {
            nEstimators,
            maxDepth,
            maxLeaves = 0,
            maxBin = 256,
            growPolicy = "depthwise",
            learningRate,
            objective = "reg:squarederror",
            booster = "gbtree",
            treeMethod = "hist",
            nThread,
            gamma = 0f,
            minChildWeight = 1,
            maxDeltaStep = 0,
            subsample = 1f,
            samplingMethod = "uniform",
            colSampleByTree = 1f,
            colSampleByLevel = 1f,
            colSampleByNode = 1f,
            regAlpha = 0f,
            regLambda = 1f,
            baseScore = 0.5f,
            seed,
            device = "cpu"
        });

        using var regressor = new XGBRegressor(
            nEstimators: nEstimators,
            maxDepth: maxDepth,
            maxLeaves: 0,
            maxBin: 256,
            growPolicy: "depthwise",
            learningRate: learningRate,
            verbosity: 0,
            objective: "reg:squarederror",
            booster: "gbtree",
            treeMethod: "hist",
            nThread: nThread,
            gamma: 0,
            minChildWeight: 1,
            maxDeltaStep: 0,
            subsample: 1,
            samplingMethod: "uniform",
            colSampleByTree: 1,
            colSampleByLevel: 1,
            colSampleByNode: 1,
            regAlpha: 0,
            regLambda: 1,
            scalePosWeight: 1,
            baseScore: 0.5f,
            seed: seed,
            missing: float.NaN,
            numParallelTree: 1,
            importanceType: "gain",
            device: "cpu",
            validateParameters: true);

        var trainingFeatures = Features(training);
        var trainingLabels = Labels(training);
        regressor.Fit(trainingFeatures, trainingLabels);
        cancellationToken.ThrowIfCancellationRequested();

        var validationFeatures = Features(validation);
        var trainingPredictions = regressor.Predict(trainingFeatures);
        var validationPredictions = regressor.Predict(validationFeatures);
        var artifactBytes = regressor.SaveModelToByteArray("json");
        if (artifactBytes.Length == 0)
            throw new InvalidOperationException("XGBoost produced an empty model artifact.");

        var sha = Convert.ToHexString(SHA256.HashData(artifactBytes))
            .ToLowerInvariant();
        var metrics = new HennaXGBoostOfflineMetrics(
            training.Length,
            validation.Length,
            Mse(trainingLabels, trainingPredictions),
            Mse(Labels(validation), validationPredictions),
            data[0].RubricVersion);

        return new(
            ModelVersion,
            ArtifactFormat,
            sha,
            artifactBytes,
            parametersJson,
            metrics);
    }

    private static float[][] Features(ReviewedNeedExample[] rows) =>
        rows.Select(x => new[]
        {
            (float)x.Scores.Health,
            (float)x.Scores.EconomicHardship,
            (float)x.Scores.AgeAndDependency,
            (float)x.Scores.HouseholdSize,
            (float)x.Scores.CareAndSupport,
            (float)x.Scores.Education
        }).ToArray();

    private static float[] Labels(ReviewedNeedExample[] rows) =>
        rows.Select(x => (float)x.ReviewedNeedScore).ToArray();

    private static double Mse(float[] expected, float[] predicted)
    {
        if (expected.Length == 0 || expected.Length != predicted.Length)
            throw new InvalidOperationException("Prediction shape is invalid.");
        double sum = 0;
        for (var i = 0; i < expected.Length; i++)
        {
            var residual = predicted[i] - expected[i];
            sum += residual * residual;
        }
        return sum / expected.Length;
    }
}
