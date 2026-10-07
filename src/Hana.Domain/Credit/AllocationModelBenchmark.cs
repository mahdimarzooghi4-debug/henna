using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Domain.Credit;

public sealed record RegressionDiagnosticMetrics(
    int Count,
    double Mse,
    double Rmse,
    double Mae,
    double MeanResidual,
    double MeanPrediction,
    double MeanObserved,
    double? CalibrationIntercept,
    double? CalibrationSlope);

public static class RegressionDiagnosticEvaluator
{
    public static RegressionDiagnosticMetrics Evaluate(
        IReadOnlyList<double> observed,
        IReadOnlyList<double> predicted)
    {
        ArgumentNullException.ThrowIfNull(observed);
        ArgumentNullException.ThrowIfNull(predicted);
        if (observed.Count == 0 || observed.Count != predicted.Count)
            throw new ArgumentException(
                "Observed and predicted values must have the same non-zero length.");

        var count = observed.Count;
        double squared = 0;
        double absolute = 0;
        double residualSum = 0;
        double predictionSum = 0;
        double observedSum = 0;
        for (var i = 0; i < count; i++)
        {
            var actual = observed[i];
            var estimate = predicted[i];
            if (!double.IsFinite(actual) || !double.IsFinite(estimate))
                throw new ArgumentException(
                    "Regression diagnostics require finite values.");
            var residual = estimate - actual;
            squared += residual * residual;
            absolute += Math.Abs(residual);
            residualSum += residual;
            predictionSum += estimate;
            observedSum += actual;
        }

        var meanPrediction = predictionSum / count;
        var meanObserved = observedSum / count;
        double predictionVarianceNumerator = 0;
        double covarianceNumerator = 0;
        for (var i = 0; i < count; i++)
        {
            var predictionDelta = predicted[i] - meanPrediction;
            predictionVarianceNumerator += predictionDelta * predictionDelta;
            covarianceNumerator +=
                predictionDelta * (observed[i] - meanObserved);
        }

        double? slope = null;
        double? intercept = null;
        if (predictionVarianceNumerator != 0d)
        {
            slope = covarianceNumerator / predictionVarianceNumerator;
            intercept = meanObserved - slope.Value * meanPrediction;
        }

        var mse = squared / count;
        return new(
            count,
            mse,
            Math.Sqrt(mse),
            absolute / count,
            residualSum / count,
            meanPrediction,
            meanObserved,
            intercept,
            slope);
    }
}

public sealed record AllocationModelBenchmarkMetrics(
    int EvaluationCount,
    decimal BaselineMse,
    decimal CandidateMse,
    decimal CandidateMinusBaselineMse,
    string RubricVersion,
    string EvaluationFingerprint,
    DateTimeOffset CutoffUtc,
    RegressionDiagnosticMetrics? BaselineDiagnostics,
    RegressionDiagnosticMetrics? CandidateDiagnostics);

/// <summary>
/// Model-agnostic held-out evaluator. It compares two immutable weight profiles
/// against labels reserved exclusively for independent evaluation. It does not
/// choose a winner, define an approval threshold, or activate anything.
/// </summary>
public static class AllocationModelBenchmarkEvaluator
{
    public const string ProtocolVersion =
        "henna-allocation-benchmark-v2";
    public const string EvaluationFingerprintProtocolVersion =
        "henna-allocation-benchmark-v1";

    public static AllocationModelBenchmarkMetrics Evaluate(
        IReadOnlyList<ReviewedNeedExample> examples,
        AllocationWeightProfile baseline,
        AllocationWeightProfile candidate,
        DateTimeOffset cutoffUtc)
    {
        ArgumentNullException.ThrowIfNull(examples);
        ArgumentNullException.ThrowIfNull(baseline);
        ArgumentNullException.ThrowIfNull(candidate);
        if (cutoffUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("UTC cutoff required.");
        if (baseline.Version == candidate.Version)
            throw new ArgumentException(
                "Benchmark candidate must differ from baseline.");

        var data = examples
            .OrderBy(x => x?.HouseholdKey)
            .ToArray();
        if (data.Length is < 1 or > 10000 ||
            data.Any(x =>
                x is null ||
                x.HouseholdKey == Guid.Empty ||
                x.ReviewerKey == Guid.Empty ||
                x.Scores is null ||
                x.ReviewedNeedScore is < 0m or > 1m ||
                string.IsNullOrWhiteSpace(x.RubricVersion) ||
                x.RubricVersion.Length > 120 ||
                x.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                x.ReviewedAtUtc > cutoffUtc ||
                x.Partition != LearningPartition.Evaluation) ||
            data.Select(x => x.HouseholdKey).Distinct().Count() != data.Length)
            throw new ArgumentException(
                "Complete distinct independent evaluation labels are required.");
        if (data.Select(x => x.RubricVersion).Distinct().Count() != 1)
            throw new ArgumentException(
                "One reviewed evaluation rubric is required.");

        var observed = data
            .Select(x => (double)x.ReviewedNeedScore)
            .ToArray();
        var baselinePredictions = data
            .Select(x => (double)Predict(x, baseline))
            .ToArray();
        var candidatePredictions = data
            .Select(x => (double)Predict(x, candidate))
            .ToArray();
        var baselineDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                observed, baselinePredictions);
        var candidateDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                observed, candidatePredictions);
        var baselineMse = Mse(data, baseline);
        var candidateMse = Mse(data, candidate);
        var fingerprint = ComputeEvaluationFingerprint(data, baseline, cutoffUtc);

        return new(
            data.Length,
            baselineMse,
            candidateMse,
            candidateMse - baselineMse,
            data[0].RubricVersion,
            fingerprint,
            cutoffUtc,
            baselineDiagnostics,
            candidateDiagnostics);
    }

    private static decimal Mse(
        ReviewedNeedExample[] rows,
        AllocationWeightProfile profile) =>
        rows.Sum(row =>
        {
            var residual =
                Predict(row, profile) - row.ReviewedNeedScore;
            return residual * residual;
        }) / rows.Length;

    private static decimal Predict(
        ReviewedNeedExample row,
        AllocationWeightProfile profile) =>
        profile.Health * row.Scores.Health / 3m +
        profile.Hardship * row.Scores.EconomicHardship / 3m +
        profile.Age * row.Scores.AgeAndDependency / 3m +
        profile.Size * row.Scores.HouseholdSize / 3m +
        profile.Care * row.Scores.CareAndSupport / 3m +
        profile.Education * row.Scores.Education / 3m;

    /// <summary>
    /// Stable identity of one frozen independent Evaluation set and baseline.
    /// The identity deliberately excludes the candidate/model/artifact so evidence
    /// from different model families can be aligned without selecting a winner.
    /// Callers must validate the Evaluation rows before computing the identity.
    /// </summary>
    public static string ComputeEvaluationFingerprint(
        ReviewedNeedExample[] rows,
        AllocationWeightProfile baseline,
        DateTimeOffset cutoffUtc)
    {
        ArgumentNullException.ThrowIfNull(rows);
        ArgumentNullException.ThrowIfNull(baseline);
        if (cutoffUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("UTC cutoff required.");
        var text = new StringBuilder(EvaluationFingerprintProtocolVersion)
            .Append('|').Append(baseline.Version)
            .Append('|').Append(cutoffUtc.ToString(
                "O", CultureInfo.InvariantCulture));
        foreach (var weight in new[]
        {
            baseline.Health,
            baseline.Hardship,
            baseline.Age,
            baseline.Size,
            baseline.Care,
            baseline.Education
        })
            text.Append('|').Append(
                weight.ToString(CultureInfo.InvariantCulture));

        foreach (var row in rows)
        {
            text.Append('\n')
                .Append(row.HouseholdKey)
                .Append('|').Append(row.ReviewerKey)
                .Append('|').Append(row.RubricVersion.Length)
                .Append(':').Append(row.RubricVersion)
                .Append('|').Append(row.ReviewedAtUtc.ToString(
                    "O", CultureInfo.InvariantCulture))
                .Append('|').Append(
                    row.ReviewedNeedScore.ToString(
                        CultureInfo.InvariantCulture))
                .Append('|').Append(row.Scores.Health)
                .Append('|').Append(row.Scores.EconomicHardship)
                .Append('|').Append(row.Scores.AgeAndDependency)
                .Append('|').Append(row.Scores.HouseholdSize)
                .Append('|').Append(row.Scores.CareAndSupport)
                .Append('|').Append(row.Scores.Education);
        }

        return Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(text.ToString())))
            .ToLowerInvariant();
    }
}
