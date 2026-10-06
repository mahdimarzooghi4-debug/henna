using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Domain.Credit;

public sealed record AllocationModelBenchmarkMetrics(
    int EvaluationCount,
    decimal BaselineMse,
    decimal CandidateMse,
    decimal CandidateMinusBaselineMse,
    string RubricVersion,
    string EvaluationFingerprint,
    DateTimeOffset CutoffUtc);

/// <summary>
/// Model-agnostic held-out evaluator. It compares two immutable weight profiles
/// against labels reserved exclusively for independent evaluation. It does not
/// choose a winner, define an approval threshold, or activate anything.
/// </summary>
public static class AllocationModelBenchmarkEvaluator
{
    public const string ProtocolVersion =
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

        var baselineMse = Mse(data, baseline);
        var candidateMse = Mse(data, candidate);
        var fingerprint = Fingerprint(data, baseline, cutoffUtc);

        return new(
            data.Length,
            baselineMse,
            candidateMse,
            candidateMse - baselineMse,
            data[0].RubricVersion,
            fingerprint,
            cutoffUtc);
    }

    private static decimal Mse(
        ReviewedNeedExample[] rows,
        AllocationWeightProfile profile) =>
        rows.Sum(row =>
        {
            var prediction =
                profile.Health * row.Scores.Health / 3m +
                profile.Hardship * row.Scores.EconomicHardship / 3m +
                profile.Age * row.Scores.AgeAndDependency / 3m +
                profile.Size * row.Scores.HouseholdSize / 3m +
                profile.Care * row.Scores.CareAndSupport / 3m +
                profile.Education * row.Scores.Education / 3m;
            var residual = prediction - row.ReviewedNeedScore;
            return residual * residual;
        }) / rows.Length;

    private static string Fingerprint(
        ReviewedNeedExample[] rows,
        AllocationWeightProfile baseline,
        DateTimeOffset cutoffUtc)
    {
        var text = new StringBuilder(ProtocolVersion)
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
