using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Hana.Domain.Credit;

public enum LearningPartition { Training = 1, Validation = 2, Evaluation = 3 }
public sealed record ReviewedNeedExample(Guid HouseholdKey, HouseholdNeedScores Scores,
    decimal ReviewedNeedScore, Guid ReviewerKey, string RubricVersion,
    DateTimeOffset ReviewedAtUtc, LearningPartition Partition);
public sealed record AllocationLearningMetrics(int TrainingCount, int ValidationCount,
    decimal BaselineValidationMse, decimal CandidateValidationMse, decimal TrainingMse,
    string RubricVersion, string DatasetFingerprint, DateTimeOffset CutoffUtc);
public sealed record LearnedAllocationWeights(AllocationWeightProfile Candidate,
    AllocationLearningMetrics Metrics);

/// <summary>Experimental constrained supervised regression of independently reviewed need scores.
/// Does not learn from spending, establish eligibility, or authorize allocation.</summary>
public static class ExperimentalAllocationWeightLearner
{
    public const string ModelVersion = "henna-constrained-regression-v1-experimental";
    public const decimal Step = .01m;
    public const decimal MaximumWeightChange = .05m;

    public static LearnedAllocationWeights Train(IReadOnlyList<ReviewedNeedExample> examples,
        AllocationWeightProfile baseline, DateTimeOffset cutoffUtc,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(examples);
        ArgumentNullException.ThrowIfNull(baseline);
        if (cutoffUtc.Offset != TimeSpan.Zero) throw new ArgumentException("UTC cutoff required.");
        var data = examples.OrderBy(x => x?.HouseholdKey).ToArray();
        if (data.Length > 10000 || data.Any(x => x is null || x.HouseholdKey == Guid.Empty ||
            x.ReviewerKey == Guid.Empty || x.Scores is null || x.ReviewedNeedScore is < 0m or > 1m ||
            string.IsNullOrWhiteSpace(x.RubricVersion) || x.RubricVersion.Length > 120 ||
            x.ReviewedAtUtc.Offset != TimeSpan.Zero || x.ReviewedAtUtc > cutoffUtc ||
            !Enum.IsDefined(x.Partition)) || data.Select(x => x.HouseholdKey).Distinct().Count() != data.Length)
            throw new ArgumentException("Complete, distinct reviewed households are required.");
        if (data.Select(x => x.RubricVersion).Distinct().Count() != 1)
            throw new ArgumentException("One reviewed scoring rubric is required.");
        var training = data.Where(x => x.Partition == LearningPartition.Training).ToArray();
        var validation = data.Where(x => x.Partition == LearningPartition.Validation).ToArray();
        if (training.Length < 30 || validation.Length < 10)
            throw new ArgumentException("At least 30 training and 10 held-out households are required.");
        var initial = Weights(baseline);
        var current = initial.ToArray();
        var error = Mse(training, current);
        // Fit uses training examples only. Validation never chooses a search step.
        for (var iteration = 0; iteration < 200; iteration++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            decimal[]? best = null;
            var bestError = error;
            for (var from = 0; from < 6; from++)
            for (var to = 0; to < 6; to++)
            {
                if (from == to) continue;
                var trial = current.ToArray();
                trial[from] -= Step; trial[to] += Step;
                if (trial.Any(x => x < 0m || x > 1m) ||
                    trial.Where((x, i) => Math.Abs(x - initial[i]) > MaximumWeightChange).Any()) continue;
                var trialError = Mse(training, trial);
                if (trialError < bestError) { best = trial; bestError = trialError; }
            }
            if (best is null) break;
            current = best; error = bestError;
        }
        var baselineValidation = Mse(validation, initial);
        var candidateValidation = Mse(validation, current);
        if (baselineValidation == 0m || candidateValidation >= baselineValidation * .99m)
            throw new InvalidOperationException("No candidate improved held-out error by at least one percent.");
        var fingerprint = Fingerprint(data, baseline, cutoffUtc);
        var candidate = new AllocationWeightProfile("henna-learned-" + fingerprint[..24],
            current[0], current[1], current[2], current[3], current[4], current[5]);
        return new(candidate, new(training.Length, validation.Length, baselineValidation,
            candidateValidation, error, data[0].RubricVersion, fingerprint, cutoffUtc));
    }

    private static decimal[] Weights(AllocationWeightProfile p) =>
        [p.Health, p.Hardship, p.Age, p.Size, p.Care, p.Education];
    private static int[] Features(HouseholdNeedScores s) =>
        [s.Health, s.EconomicHardship, s.AgeAndDependency, s.HouseholdSize, s.CareAndSupport, s.Education];
    private static decimal Mse(ReviewedNeedExample[] rows, decimal[] weights) => rows.Sum(row =>
    {
        var features = Features(row.Scores);
        var prediction = weights.Select((w, i) => w * features[i] / 3m).Sum();
        var residual = prediction - row.ReviewedNeedScore;
        return residual * residual;
    }) / rows.Length;

    private static string Fingerprint(ReviewedNeedExample[] rows, AllocationWeightProfile baseline,
        DateTimeOffset cutoff)
    {
        var text = new StringBuilder(ModelVersion).Append('|').Append(baseline.Version)
            .Append('|').Append(cutoff.ToString("O", CultureInfo.InvariantCulture));
        foreach (var weight in Weights(baseline)) text.Append('|').Append(weight.ToString(CultureInfo.InvariantCulture));
        foreach (var row in rows)
        {
            text.Append('\n').Append(row.HouseholdKey).Append('|').Append(row.ReviewerKey)
                .Append('|').Append(row.RubricVersion.Length).Append(':').Append(row.RubricVersion)
                .Append('|').Append(row.ReviewedAtUtc.ToString("O", CultureInfo.InvariantCulture))
                .Append('|').Append((int)row.Partition).Append('|')
                .Append(row.ReviewedNeedScore.ToString(CultureInfo.InvariantCulture));
            foreach (var score in Features(row.Scores)) text.Append('|').Append(score);
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString()))).ToLowerInvariant();
    }
}
