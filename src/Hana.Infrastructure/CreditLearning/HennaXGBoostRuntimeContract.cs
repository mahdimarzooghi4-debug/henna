using System.Security.Cryptography;
using Hana.Domain.Credit;
using XGBoostSharp;

namespace Hana.Infrastructure.CreditLearning;

public sealed record HennaXGBoostRuntimeCandidate(
    Guid TrainingRunId,
    Guid BenchmarkId,
    string EvaluationFingerprint,
    string ModelVersion,
    string ArtifactFormat,
    string ArtifactSha256,
    byte[] ArtifactBytes);

public sealed record HennaXGBoostRuntimePrediction(
    string RuntimeContractVersion,
    Guid TrainingRunId,
    Guid BenchmarkId,
    string EvaluationFingerprint,
    string ModelVersion,
    string ArtifactSha256,
    double RawNeedScore);

/// <summary>
/// In-process execution contract for a governed XGBoost candidate artifact.
/// This contract only reproduces the model's raw need-score prediction. It
/// does not map predictions to allocation weights, eligibility, payments,
/// wallets, pilot authorization or Production activation.
/// </summary>
public static class HennaXGBoostRuntimeContract
{
    public const string RuntimeContractVersion =
        "henna-xgboost-runtime-contract-v1";

    public static HennaXGBoostRuntimePrediction EvaluateRaw(
        HennaXGBoostRuntimeCandidate candidate,
        HouseholdNeedScores scores)
    {
        ArgumentNullException.ThrowIfNull(candidate);
        ArgumentNullException.ThrowIfNull(scores);
        ValidateCandidate(candidate);

        var actualSha = Convert.ToHexString(
            SHA256.HashData(candidate.ArtifactBytes))
            .ToLowerInvariant();
        if (!string.Equals(
                actualSha,
                candidate.ArtifactSha256,
                StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "XGBoost runtime artifact attestation is invalid.");

        using var model =
            XGBRegressor.LoadFromByteArray(candidate.ArtifactBytes);
        var predictions = model.Predict(
            [Features(scores)]);
        if (predictions.Length != 1 ||
            !float.IsFinite(predictions[0]))
            throw new InvalidOperationException(
                "XGBoost runtime prediction is invalid.");

        return new(
            RuntimeContractVersion,
            candidate.TrainingRunId,
            candidate.BenchmarkId,
            candidate.EvaluationFingerprint,
            candidate.ModelVersion,
            candidate.ArtifactSha256.ToLowerInvariant(),
            predictions[0]);
    }

    private static void ValidateCandidate(
        HennaXGBoostRuntimeCandidate candidate)
    {
        if (candidate.TrainingRunId == Guid.Empty ||
            candidate.BenchmarkId == Guid.Empty)
            throw new ArgumentException(
                "Training-run and benchmark lineage are required.");

        if (!string.Equals(
                candidate.ModelVersion,
                HennaXGBoostOfflineLearner.ModelVersion,
                StringComparison.Ordinal))
            throw new ArgumentException(
                "The runtime candidate must use the selected Henna XGBoost model version.");

        if (!string.Equals(
                candidate.ArtifactFormat,
                HennaXGBoostOfflineLearner.ArtifactFormat,
                StringComparison.Ordinal))
            throw new ArgumentException(
                "The runtime candidate must use the approved XGBoost artifact format.");

        if (!IsSha256(candidate.ArtifactSha256) ||
            candidate.ArtifactBytes is null ||
            candidate.ArtifactBytes.Length == 0)
            throw new ArgumentException(
                "A complete immutable XGBoost artifact is required.");

        if (!IsSha256(candidate.EvaluationFingerprint))
            throw new ArgumentException(
                "A complete independent Evaluation fingerprint is required.");
    }

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } &&
        value.All(Uri.IsHexDigit);

    private static float[] Features(HouseholdNeedScores scores) =>
    [
        scores.Health,
        scores.EconomicHardship,
        scores.AgeAndDependency,
        scores.HouseholdSize,
        scores.CareAndSupport,
        scores.Education
    ];
}
