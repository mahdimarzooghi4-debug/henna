using System.Data;
using System.Text.Json;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record ResearchEvaluationSourceReverification(
    string ContractVersion, string Family, Guid ArtifactId, Guid TrainingRunId,
    Guid EvaluationId, string ArtifactSha256, string EvaluationFingerprint,
    string DatasetVersion, string EvaluationProtocolVersion,
    string Status, int ReconstructedEvaluationCount, bool ArtifactHashVerified,
    bool StoredEvaluationContentMatches, bool FirstPartyRuntimeLineageRechecked,
    bool HistoricalSourceAuthenticityAttested, bool DatasetAdmitted,
    bool ModelApproved, bool RegistryRecordCreated, bool RuntimeApplied);

/// <summary>
/// Reconstructs the existing benchmark's frozen Evaluation fingerprint from
/// current persisted first-party snapshots + human-reviewed labels.
/// Fail-closed and no writes. Does not establish source rights or review quality.
/// </summary>
public sealed class AllocationEvaluationSourceReverificationService(
    HanaAllocationLearningDbContext db)
{
    public const string ContractVersion = "HENNA-EVALUATION-STORED-CONTENT-REVERIFICATION-v1";
    public const string Status = "STORED_EVALUATION_CONTENT_MATCHED_NOT_ADMITTED";

    public async Task<ResearchEvaluationSourceReverification> PreviewAsync(
        string family, Guid artifactId, Guid evaluationId, CancellationToken ct = default)
    {
        if (family is not ("XGBOOST" or "EBM") ||
            artifactId == Guid.Empty || evaluationId == Guid.Empty)
            throw new ArgumentException("Explicit supported artifact and Evaluation required.");

        // Artifact, selected benchmark, labels, first-party assessment/runtime
        // history all belong to one consistent PostgreSQL snapshot.
        await using var tx = await db.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);
        var benchmark = family == "XGBOOST"
            ? await db.ShadowModelBenchmarks.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == evaluationId &&
                    x.TrainingRunId == artifactId, ct)
            : null;
        var ebmBenchmark = family == "EBM"
            ? await db.EbmModelBenchmarks.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == evaluationId &&
                    x.EbmArtifactId == artifactId, ct)
            : null;
        if (benchmark is null && ebmBenchmark is null)
            throw new ArgumentException("No exact stored Evaluation for this artifact.");

        var runId = benchmark?.TrainingRunId ?? ebmBenchmark!.TrainingRunId;
        var run = await db.TrainingRuns.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == runId, ct)
            ?? throw new InvalidOperationException("Evaluation training run is absent.");

        ResearchModelArtifactDossier dossier;
        if (family == "XGBOOST")
            dossier = AllocationModelArtifactDossierService.BuildXgboost(run, [benchmark!]);
        else
        {
            var artifact = await db.EbmArtifacts.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == artifactId, ct)
                ?? throw new InvalidOperationException("EBM artifact is absent.");
            dossier = AllocationModelArtifactDossierService.BuildEbm(
                artifact, run, [ebmBenchmark!]);
        }
        var technical = AllocationModelVersionTechnicalPreflightService.Inspect(
            dossier, evaluationId);

        var json = benchmark?.EvaluationLabelIdsJson ??
            ebmBenchmark!.EvaluationLabelIdsJson;
        var storedFingerprint = technical.EvaluationFingerprint;
        var cutoff = benchmark?.CutoffUtc ?? ebmBenchmark!.CutoffUtc;
        var rubricVersion = "";
        var sourceReference = technical.SourceInstructionReference;
        var recordedBaseline = benchmark?.BaselineVersion ?? ebmBenchmark!.BaselineVersion;
        var runtimeProposalId = family == "XGBOOST"
            ? benchmark!.RuntimeProposalId : ebmBenchmark!.RuntimeProposalId;
        var runtimeSequence = family == "XGBOOST"
            ? benchmark!.RuntimeProfileSequence : ebmBenchmark!.RuntimeProfileSequence;

        var labelIds = JsonSerializer.Deserialize<Guid[]>(json)
            ?? throw new InvalidOperationException("Evaluation label inventory is absent.");
        if (labelIds.Length is < 1 or > 500 ||
            labelIds.Any(x => x == Guid.Empty) ||
            labelIds.Distinct().Count() != labelIds.Length ||
            !labelIds.SequenceEqual(labelIds.OrderBy(x => x)))
            throw new InvalidOperationException("Invalid stored Evaluation label identity.");

        using var inputs = JsonDocument.Parse(run.InputsJson);
        var root = inputs.RootElement;
        var baseline = JsonSerializer.Deserialize<AllocationWeightProfile>(
            root.GetProperty("baseline").GetRawText())
            ?? throw new InvalidOperationException("Frozen baseline not reconstructable.");
        var instruction = root.GetProperty("sourceInstructionReference").GetString();
        var frozen = JsonSerializer.Deserialize<ReviewedNeedExample[]>(
            root.GetProperty("examples").GetRawText())
            ?? throw new InvalidOperationException("Frozen training examples absent.");
        var frozenHouseholds = frozen.Select(x => x.HouseholdKey).ToHashSet();
        var expectedProposal = root.GetProperty("baselineRuntimeProposalId");
        var expectedSequence = root.GetProperty("baselineRuntimeProfileSequence");
        var baselineProposalId = expectedProposal.ValueKind == JsonValueKind.Null
            ? (Guid?)null : expectedProposal.GetGuid();
        var baselineSequence = expectedSequence.ValueKind == JsonValueKind.Null
            ? (long?)null : expectedSequence.GetInt64();

        if (frozen.Length == 0 ||
            frozen.Any(x => x.Partition is not (
                LearningPartition.Training or LearningPartition.Validation)) ||
            frozenHouseholds.Count != frozen.Length ||
            baseline.Version != recordedBaseline ||
            sourceReference != instruction ||
            baselineProposalId != runtimeProposalId ||
            baselineSequence != runtimeSequence ||
            cutoff.Offset != TimeSpan.Zero)
            throw new InvalidOperationException("Stored training/evaluation baseline lineage has drifted.");

        var labels = await db.NeedLabels.AsNoTracking()
            .Where(x => labelIds.Contains(x.Id))
            .OrderBy(x => x.Id)
            .ToArrayAsync(ct);
        if (labels.Length != labelIds.Length ||
            !labels.Select(x => x.Id).SequenceEqual(labelIds) ||
            labels.Any(x => x.Partition != (int)LearningPartition.Evaluation ||
                x.ReviewerAccountId == Guid.Empty ||
                x.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                x.ReviewedAtUtc > cutoff ||
                x.NeedScore is < 0m or > 1m ||
                string.IsNullOrWhiteSpace(x.RubricVersion) ||
                AllocationRubricFoundationBoundary.IsNonLabelingFoundation(x.RubricVersion)))
            throw new InvalidOperationException("Stored Evaluation labels no longer valid.");

        var snapshotIds = labels.Select(x => x.SnapshotId).Distinct().ToArray();
        var snapshots = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (snapshots.Count != labels.Length ||
            labels.Any(x => !snapshots.ContainsKey(x.SnapshotId)))
            throw new InvalidOperationException("Stored Evaluation snapshot lineage is missing.");

        var records = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        if (records.Select(x => x.HouseholdKey).Distinct().Count() != records.Length ||
            records.Any(x => x.HouseholdKey == Guid.Empty ||
                frozenHouseholds.Contains(x.HouseholdKey) ||
                x.FormulaVersion != baseline.Version ||
                x.DatasetVersion != run.DatasetVersion ||
                x.SourceInstructionReference != instruction))
            throw new InvalidOperationException("Evaluation/training household or dataset lineage drift.");

        var runtime = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, records, ct);
        if (runtime.Count != records.Length ||
            records.Any(x => !runtime.TryGetValue(x.Id, out var found) ||
                found.RuntimeProposalId != runtimeProposalId ||
                found.RuntimeProfileSequence != runtimeSequence ||
                found.Baseline != baseline))
            throw new InvalidOperationException("Current first-party runtime lineage is invalid.");

        var examples = labels.Select(label =>
        {
            var s = snapshots[label.SnapshotId];
            return new ReviewedNeedExample(
                s.HouseholdKey,
                new(s.Health, s.Hardship, s.Age, s.Size, s.Care, s.Education),
                label.NeedScore, label.ReviewerAccountId, label.RubricVersion,
                label.ReviewedAtUtc, LearningPartition.Evaluation);
        }).OrderBy(x => x.HouseholdKey).ToArray();
        if (examples.Select(x => x.RubricVersion).Distinct().Count() != 1 ||
            examples.Any(x => x.ReviewedAtUtc > cutoff))
            throw new InvalidOperationException("Evaluation rubric and cutoff drift.");
        rubricVersion = examples[0].RubricVersion;

        var recomputed = AllocationModelBenchmarkEvaluator
            .ComputeEvaluationFingerprint(examples, baseline, cutoff);
        var metricsJson = benchmark?.MetricsJson ?? ebmBenchmark!.MetricsJson;
        using var metrics = JsonDocument.Parse(metricsJson);
        var metricRoot = metrics.RootElement;
        if (recomputed != storedFingerprint ||
            metricRoot.GetProperty("EvaluationFingerprint").GetString() != recomputed ||
            metricRoot.GetProperty("EvaluationCount").GetInt32() != examples.Length ||
            metricRoot.GetProperty("RubricVersion").GetString() != rubricVersion ||
            metricRoot.GetProperty("CutoffUtc").GetDateTimeOffset() != cutoff)
            throw new InvalidOperationException("Current stored Evaluation content fingerprint does not match.");

        await tx.CommitAsync(ct);
        return new(
            ContractVersion, family, artifactId, runId, evaluationId,
            technical.ArtifactSha256, recomputed, technical.DatasetVersion,
            technical.EvaluationProtocolVersion, Status, examples.Length,
            true, true, true,
            false, false, false, false, false);
    }
}
