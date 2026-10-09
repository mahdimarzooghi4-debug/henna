using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using XGBoostSharp;

namespace Hana.Infrastructure.CreditLearning;

public sealed record HennaXGBoostShadowBenchmarkMetrics(
    int EvaluationCount,
    double BaselineMse,
    double ShadowMse,
    double ShadowMinusBaselineMse,
    string RubricVersion,
    string EvaluationFingerprint,
    DateTimeOffset CutoffUtc,
    RegressionDiagnosticMetrics? BaselineDiagnostics,
    RegressionDiagnosticMetrics? ShadowDiagnostics);

public sealed class AllocationShadowModelBenchmarkRecord
{
    public Guid Id { get; set; }
    public Guid TrainingRunId { get; set; }
    public Guid EvaluatedByAccountId { get; set; }
    public string ProtocolVersion { get; set; } = "";
    public string ModelVersion { get; set; } = "";
    public string ArtifactSha256 { get; set; } = "";
    public string BaselineVersion { get; set; } = "";
    public string DatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public Guid? RuntimeProposalId { get; set; }
    public long? RuntimeProfileSequence { get; set; }
    public string EvaluationLabelIdsJson { get; set; } = "";
    public string EvaluationFingerprint { get; set; } = "";
    public string MetricsJson { get; set; } = "";
    public DateTimeOffset CutoffUtc { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class AllocationShadowModelBenchmarkConflictException(string message)
    : Exception(message) { }

/// <summary>
/// Independent held-out evaluation for an immutable XGBoost shadow artifact.
/// It records evidence only and cannot choose a winner or affect runtime.
/// </summary>
public static class HennaXGBoostShadowBenchmarkEvaluator
{
    public const string ProtocolVersion =
        "henna-xgboost-shadow-benchmark-v3";

    public static HennaXGBoostShadowBenchmarkMetrics Evaluate(
        IReadOnlyList<ReviewedNeedExample> examples,
        AllocationWeightProfile baseline,
        byte[] artifactBytes,
        string artifactSha256,
        DateTimeOffset cutoffUtc)
    {
        ArgumentNullException.ThrowIfNull(examples);
        ArgumentNullException.ThrowIfNull(baseline);
        ArgumentNullException.ThrowIfNull(artifactBytes);
        if (cutoffUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("UTC cutoff required.");
        if (artifactBytes.Length == 0 ||
            artifactSha256.Length != 64 ||
            artifactSha256.Any(x => !Uri.IsHexDigit(x)))
            throw new ArgumentException("A valid immutable XGBoost artifact is required.");

        var actualSha = Convert.ToHexString(
            SHA256.HashData(artifactBytes)).ToLowerInvariant();
        if (!string.Equals(actualSha, artifactSha256,
                StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Stored XGBoost artifact attestation is invalid.");

        var data = examples.OrderBy(x => x?.HouseholdKey).ToArray();
        if (data.Length is < 1 or > 500 ||
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
        AllocationRubricFoundationBoundary.RejectNonLabelingFoundation(data[0].RubricVersion);

        var features = data.Select(Features).ToArray();
        using var model = XGBRegressor.LoadFromByteArray(artifactBytes);
        var predictions = model.Predict(features);
        if (predictions.Length != data.Length ||
            predictions.Any(x => !float.IsFinite(x)))
            throw new InvalidOperationException(
                "XGBoost evaluation predictions are invalid.");

        var expected = data.Select(x => (double)x.ReviewedNeedScore).ToArray();
        var baselinePredictions = data.Select(x =>
            (double)(
                baseline.Health * x.Scores.Health / 3m +
                baseline.Hardship * x.Scores.EconomicHardship / 3m +
                baseline.Age * x.Scores.AgeAndDependency / 3m +
                baseline.Size * x.Scores.HouseholdSize / 3m +
                baseline.Care * x.Scores.CareAndSupport / 3m +
                baseline.Education * x.Scores.Education / 3m))
            .ToArray();

        var shadowPredictions =
            predictions.Select(x => (double)x).ToArray();
        var baselineDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                expected, baselinePredictions);
        var shadowDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                expected, shadowPredictions);
        var baselineMse = baselineDiagnostics.Mse;
        var shadowMse = shadowDiagnostics.Mse;
        var fingerprint = AllocationModelBenchmarkEvaluator
            .ComputeEvaluationFingerprint(data, baseline, cutoffUtc);

        return new(
            data.Length,
            baselineMse,
            shadowMse,
            shadowMse - baselineMse,
            data[0].RubricVersion,
            fingerprint,
            cutoffUtc,
            baselineDiagnostics,
            shadowDiagnostics);
    }

    private static float[] Features(ReviewedNeedExample x) =>
        [
            x.Scores.Health,
            x.Scores.EconomicHardship,
            x.Scores.AgeAndDependency,
            x.Scores.HouseholdSize,
            x.Scores.CareAndSupport,
            x.Scores.Education
        ];

}

public sealed class AllocationShadowModelBenchmarkService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<AllocationShadowModelBenchmarkRecord> EvaluateAsync(
        Guid actor,
        Guid trainingRunId,
        IReadOnlyList<Guid> evaluationLabelIds,
        DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ArgumentNullException.ThrowIfNull(evaluationLabelIds);
        var labelIds = evaluationLabelIds.OrderBy(x => x).ToArray();
        if (trainingRunId == Guid.Empty ||
            labelIds.Length is < 1 or > 500 ||
            labelIds.Any(x => x == Guid.Empty) ||
            labelIds.Distinct().Count() != labelIds.Length)
            throw new ArgumentException(
                "Training run and 1–500 distinct evaluation labels are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero ||
            cutoffUtc > clock.UtcNow)
            throw new ArgumentException(
                "A past UTC benchmark cutoff is required.");

        var run = await db.TrainingRuns.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == trainingRunId, ct)
            ?? throw new ArgumentException("Training run does not exist.");
        if (run.ShadowModelVersion is null ||
            run.ShadowArtifactFormat != HennaXGBoostOfflineLearner.ArtifactFormat ||
            run.ShadowArtifactSha256 is null ||
            run.ShadowArtifactBytes is null ||
            run.ShadowArtifactBytes.Length == 0)
            throw new ArgumentException(
                "Training run does not contain a complete XGBoost shadow artifact.");

        using var inputs = JsonDocument.Parse(run.InputsJson);
        var root = inputs.RootElement;
        var baseline = JsonSerializer.Deserialize<AllocationWeightProfile>(
            root.GetProperty("baseline").GetRawText())
            ?? throw new InvalidOperationException(
                "Training run baseline is invalid.");
        var sourceInstructionReference =
            root.GetProperty("sourceInstructionReference").GetString()
            ?? throw new InvalidOperationException(
                "Training run source instruction is invalid.");
        var runtimeProposalElement =
            root.GetProperty("baselineRuntimeProposalId");
        var runtimeProposalId =
            runtimeProposalElement.ValueKind == JsonValueKind.Null
                ? (Guid?)null
                : runtimeProposalElement.GetGuid();
        var runtimeSequenceElement =
            root.GetProperty("baselineRuntimeProfileSequence");
        var runtimeProfileSequence =
            runtimeSequenceElement.ValueKind == JsonValueKind.Null
                ? (long?)null
                : runtimeSequenceElement.GetInt64();

        var frozenHouseholds = root.GetProperty("examples")
            .EnumerateArray()
            .Select(x => x.GetProperty("HouseholdKey").GetGuid())
            .ToHashSet();

        var labels = await db.NeedLabels.AsNoTracking()
            .Where(x => labelIds.Contains(x.Id))
            .OrderBy(x => x.Id)
            .ToArrayAsync(ct);
        if (labels.Length != labelIds.Length ||
            labels.Any(x =>
                x.Partition != (int)LearningPartition.Evaluation ||
                x.ReviewedAtUtc > cutoffUtc))
            throw new ArgumentException(
                "All benchmark labels must exist, be Evaluation-only and precede the cutoff.");
        if (labels.Any(x => AllocationRubricFoundationBoundary.IsNonLabelingFoundation(x.RubricVersion)))
            throw new ArgumentException("Review foundations cannot be used for independent model evaluation.");

        var snapshotIds = labels.Select(x => x.SnapshotId).ToArray();
        var snapshots = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (snapshots.Count != snapshotIds.Distinct().Count())
            throw new ArgumentException(
                "Benchmark assessment snapshots are incomplete.");

        var rows = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        if (rows.Any(x => frozenHouseholds.Contains(x.HouseholdKey)))
            throw new ArgumentException(
                "Independent evaluation households must not overlap the training run.");

        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, rows, ct);
        if (lineage.Count != rows.Length)
            throw new ArgumentException(
                "Benchmark labels require valid first-party runtime lineage.");

        var lineages = rows.Select(x => lineage[x.Id]).ToArray();
        if (rows.Any(x =>
                x.FormulaVersion != baseline.Version ||
                x.DatasetVersion != run.DatasetVersion ||
                x.SourceInstructionReference !=
                    sourceInstructionReference) ||
            lineages.Any(x =>
                x.RuntimeProposalId != runtimeProposalId ||
                x.RuntimeProfileSequence != runtimeProfileSequence ||
                x.Baseline != baseline))
            throw new ArgumentException(
                "Benchmark labels must match the training run baseline lineage, dataset and funding instruction.");

        var examples = labels.Select(x =>
        {
            var s = snapshots[x.SnapshotId];
            return new ReviewedNeedExample(
                s.HouseholdKey,
                new(
                    s.Health,
                    s.Hardship,
                    s.Age,
                    s.Size,
                    s.Care,
                    s.Education),
                x.NeedScore,
                x.ReviewerAccountId,
                x.RubricVersion,
                x.ReviewedAtUtc,
                LearningPartition.Evaluation);
        }).ToArray();

        var metrics = HennaXGBoostShadowBenchmarkEvaluator.Evaluate(
            examples,
            baseline,
            run.ShadowArtifactBytes,
            run.ShadowArtifactSha256,
            cutoffUtc);
        var id = BenchmarkId(
            trainingRunId,
            metrics.EvaluationFingerprint,
            HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion);

        var existing = await db.ShadowModelBenchmarks.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (existing is not null)
        {
            EnsureReplayMatches(
                existing,
                trainingRunId,
                actor,
                metrics.EvaluationFingerprint,
                cutoffUtc);
            return existing;
        }

        var row = new AllocationShadowModelBenchmarkRecord
        {
            Id = id,
            TrainingRunId = trainingRunId,
            EvaluatedByAccountId = actor,
            ProtocolVersion =
                HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion,
            ModelVersion = run.ShadowModelVersion,
            ArtifactSha256 = run.ShadowArtifactSha256,
            BaselineVersion = baseline.Version,
            DatasetVersion = run.DatasetVersion,
            SourceInstructionReference =
                sourceInstructionReference,
            RuntimeProposalId = runtimeProposalId,
            RuntimeProfileSequence = runtimeProfileSequence,
            EvaluationLabelIdsJson = JsonSerializer.Serialize(labelIds),
            EvaluationFingerprint = metrics.EvaluationFingerprint,
            MetricsJson = JsonSerializer.Serialize(metrics),
            CutoffUtc = cutoffUtc,
            RecordedAtUtc = clock.UtcNow
        };
        db.ShadowModelBenchmarks.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException
                { SqlState: "23505" })
        {
            var replay = await db.ShadowModelBenchmarks.AsNoTracking()
                .SingleAsync(x => x.Id == id, ct);
            EnsureReplayMatches(
                replay,
                trainingRunId,
                actor,
                metrics.EvaluationFingerprint,
                cutoffUtc);
            return replay;
        }

        return row;
    }

    private static void EnsureReplayMatches(
        AllocationShadowModelBenchmarkRecord existing,
        Guid trainingRunId,
        Guid actor,
        string evaluationFingerprint,
        DateTimeOffset cutoffUtc)
    {
        if (existing.TrainingRunId != trainingRunId ||
            existing.EvaluatedByAccountId != actor ||
            existing.EvaluationFingerprint != evaluationFingerprint ||
            existing.CutoffUtc != cutoffUtc)
            throw new AllocationShadowModelBenchmarkConflictException(
                "Shadow benchmark identity was reused with different input.");
    }

    internal static Guid BenchmarkId(
        Guid trainingRunId,
        string evaluationFingerprint,
        string protocolVersion)
    {
        if (trainingRunId == Guid.Empty ||
            string.IsNullOrWhiteSpace(evaluationFingerprint) ||
            string.IsNullOrWhiteSpace(protocolVersion))
            throw new ArgumentException(
                "Complete shadow benchmark identity input is required.");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{protocolVersion}|{trainingRunId:D}|{evaluationFingerprint}"));
        return new Guid(hash.AsSpan(0, 16));
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }
}
