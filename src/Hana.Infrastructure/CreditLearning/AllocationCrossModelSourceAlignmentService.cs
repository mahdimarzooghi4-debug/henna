using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record CrossModelSourceSelection(
    Guid XgboostArtifactId, Guid XgboostEvaluationId,
    Guid EbmArtifactId, Guid EbmEvaluationId);

/// <summary>
/// Cross-family, read-only cohort consistency report, never a model ranking.
/// </summary>
public sealed record CrossModelSourceAlignmentReport(
    string ContractVersion, string Status, string ManifestSha256,
    Guid XgboostArtifactId, Guid XgboostEvaluationId,
    Guid EbmArtifactId, Guid EbmEvaluationId,
    string XgboostArtifactSha256, string EbmArtifactSha256,
    string XgboostEvaluationFingerprint, string EbmEvaluationFingerprint,
    bool BothStoredContentsReverified, bool EvaluationLineageAligned,
    bool HistoricalSourceAuthenticityAttested,
    bool ScientificComparabilityApproved, bool WinnerSelected,
    bool DatasetAdmitted, bool ModelRegistered, bool RuntimeApplied);

/// <summary>
/// Evaluates two explicit research families in ONE REPEATABLE READ snapshot.
/// No model selection, scores, threshold, promotion or data modification.
/// </summary>
public sealed class AllocationCrossModelSourceAlignmentService(
    HanaAllocationLearningDbContext db,
    AllocationEvaluationSourceReverificationService reverification)
{
    public const string ContractVersion = "HENNA-CROSS-MODEL-STORED-SOURCE-ALIGNMENT-v1";
    public const string AlignedStatus = "REVERIFIED_STORED_EVALUATION_LINEAGE_ALIGNED_ONLY";
    public const string MismatchStatus = "REVERIFIED_STORED_EVALUATION_LINEAGE_MISMATCH";

    public async Task<CrossModelSourceAlignmentReport> PreviewAsync(
        CrossModelSourceSelection selection, CancellationToken ct = default)
    {
        ValidateSelection(selection);
        await using var tx = await db.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);

        var xgboost = await reverification.InspectWithinSnapshotAsync(
            "XGBOOST", selection.XgboostArtifactId, selection.XgboostEvaluationId, ct);
        var ebm = await reverification.InspectWithinSnapshotAsync(
            "EBM", selection.EbmArtifactId, selection.EbmEvaluationId, ct);

        var xRow = await db.ShadowModelBenchmarks.AsNoTracking().SingleAsync(
            x => x.Id == selection.XgboostEvaluationId &&
                 x.TrainingRunId == selection.XgboostArtifactId, ct);
        var ebmRow = await db.EbmModelBenchmarks.AsNoTracking().SingleAsync(
            x => x.Id == selection.EbmEvaluationId &&
                 x.EbmArtifactId == selection.EbmArtifactId, ct);

        var result = Compare(selection, xgboost, ebm, xRow, ebmRow);
        await tx.CommitAsync(ct);
        return result;
    }

    public static CrossModelSourceAlignmentReport Compare(
        CrossModelSourceSelection selection,
        ResearchEvaluationSourceReverification xgboost,
        ResearchEvaluationSourceReverification ebm,
        AllocationShadowModelBenchmarkRecord xRow,
        AllocationEbmBenchmarkRecord ebmRow)
    {
        ValidateSelection(selection);
        ArgumentNullException.ThrowIfNull(xgboost);
        ArgumentNullException.ThrowIfNull(ebm);
        ArgumentNullException.ThrowIfNull(xRow);
        ArgumentNullException.ThrowIfNull(ebmRow);
        if (xgboost.Family != "XGBOOST" || ebm.Family != "EBM" ||
            xgboost.ContractVersion != AllocationEvaluationSourceReverificationService.ContractVersion ||
            ebm.ContractVersion != AllocationEvaluationSourceReverificationService.ContractVersion ||
            xgboost.Status != AllocationEvaluationSourceReverificationService.Status ||
            ebm.Status != AllocationEvaluationSourceReverificationService.Status ||
            xgboost.ArtifactId != selection.XgboostArtifactId ||
            ebm.ArtifactId != selection.EbmArtifactId ||
            xgboost.EvaluationId != selection.XgboostEvaluationId ||
            ebm.EvaluationId != selection.EbmEvaluationId ||
            xgboost.TrainingRunId != xRow.TrainingRunId ||
            ebm.TrainingRunId != ebmRow.TrainingRunId ||
            xRow.Id != selection.XgboostEvaluationId ||
            ebmRow.Id != selection.EbmEvaluationId ||
            xRow.TrainingRunId != selection.XgboostArtifactId ||
            ebmRow.EbmArtifactId != selection.EbmArtifactId ||
            xgboost.ArtifactSha256 != xRow.ArtifactSha256 ||
            ebm.ArtifactSha256 != ebmRow.ArtifactSha256 ||
            xgboost.EvaluationFingerprint != xRow.EvaluationFingerprint ||
            ebm.EvaluationFingerprint != ebmRow.EvaluationFingerprint ||
            xgboost.DatasetVersion != xRow.DatasetVersion ||
            ebm.DatasetVersion != ebmRow.DatasetVersion ||
            xgboost.EvaluationProtocolVersion != HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion ||
            ebm.EvaluationProtocolVersion != HennaEbmBenchmarkEvaluator.ProtocolVersion ||
            !Checked(xgboost) || !Checked(ebm))
            throw new InvalidOperationException("Stored cross-model source proof identity drift.");

        var xIds = ReadIds(xRow.EvaluationLabelIdsJson);
        var eIds = ReadIds(ebmRow.EvaluationLabelIdsJson);
        if (xIds.Length != xgboost.ReconstructedEvaluationCount ||
            eIds.Length != ebm.ReconstructedEvaluationCount)
            throw new InvalidOperationException("Evaluation label count no longer matches reconstructed source.");
        var xRubric = MetricRubric(xRow.MetricsJson);
        var eRubric = MetricRubric(ebmRow.MetricsJson);
        var aligned =
            xgboost.EvaluationFingerprint == ebm.EvaluationFingerprint &&
            xgboost.ReconstructedEvaluationCount == ebm.ReconstructedEvaluationCount &&
            xIds.SequenceEqual(eIds) &&
            xRow.DatasetVersion == ebmRow.DatasetVersion &&
            xRow.SourceInstructionReference == ebmRow.SourceInstructionReference &&
            xRow.BaselineVersion == ebmRow.BaselineVersion &&
            xRow.RuntimeProposalId == ebmRow.RuntimeProposalId &&
            xRow.RuntimeProfileSequence == ebmRow.RuntimeProfileSequence &&
            xRow.CutoffUtc == ebmRow.CutoffUtc &&
            xRubric == eRubric;

        var fingerprintPayload = JsonSerializer.Serialize(new
        {
            contractVersion = ContractVersion,
            selection.XgboostArtifactId, selection.XgboostEvaluationId,
            selection.EbmArtifactId, selection.EbmEvaluationId,
            xgboostArtifactSha256 = xgboost.ArtifactSha256,
            ebmArtifactSha256 = ebm.ArtifactSha256,
            xgboostEvaluationFingerprint = xgboost.EvaluationFingerprint,
            ebmEvaluationFingerprint = ebm.EvaluationFingerprint,
            xgboostDatasetVersion = xRow.DatasetVersion,
            ebmDatasetVersion = ebmRow.DatasetVersion,
            xgboostBaselineVersion = xRow.BaselineVersion,
            ebmBaselineVersion = ebmRow.BaselineVersion,
            xgboostSourceReference = xRow.SourceInstructionReference,
            ebmSourceReference = ebmRow.SourceInstructionReference,
            xgboostCutoff = xRow.CutoffUtc, ebmCutoff = ebmRow.CutoffUtc,
            xgboostRuntimeProposalId = xRow.RuntimeProposalId,
            ebmRuntimeProposalId = ebmRow.RuntimeProposalId,
            xgboostRuntimeSequence = xRow.RuntimeProfileSequence,
            ebmRuntimeSequence = ebmRow.RuntimeProfileSequence,
            xRubric, eRubric, aligned
        });
        var digest = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(fingerprintPayload))).ToLowerInvariant();
        return new(ContractVersion,
            aligned ? AlignedStatus : MismatchStatus, digest,
            selection.XgboostArtifactId, selection.XgboostEvaluationId,
            selection.EbmArtifactId, selection.EbmEvaluationId,
            xgboost.ArtifactSha256, ebm.ArtifactSha256,
            xgboost.EvaluationFingerprint, ebm.EvaluationFingerprint,
            true, aligned,
            false, false, false, false, false, false);
    }

    private static void ValidateSelection(CrossModelSourceSelection selection)
    {
        ArgumentNullException.ThrowIfNull(selection);
        if (selection.XgboostArtifactId == Guid.Empty ||
            selection.XgboostEvaluationId == Guid.Empty ||
            selection.EbmArtifactId == Guid.Empty ||
            selection.EbmEvaluationId == Guid.Empty ||
            selection.XgboostEvaluationId == selection.EbmEvaluationId)
            throw new ArgumentException("Two distinct explicitly chosen family-specific evaluations required.");
    }

    private static bool Checked(ResearchEvaluationSourceReverification v) =>
        v.ReconstructedEvaluationCount is >= 1 and <= 500 &&
        v.ArtifactHashVerified && v.StoredEvaluationContentMatches &&
        v.FirstPartyRuntimeLineageRechecked &&
        !v.HistoricalSourceAuthenticityAttested &&
        !v.DatasetAdmitted && !v.ModelApproved &&
        !v.RegistryRecordCreated && !v.RuntimeApplied &&
        v.EvaluationFingerprint is { Length: 64 } &&
        v.ArtifactSha256 is { Length: 64 };

    private static Guid[] ReadIds(string json)
    {
        var ids = JsonSerializer.Deserialize<Guid[]>(json)
            ?? throw new InvalidOperationException("Missing stored evaluation IDs.");
        if (ids.Length is < 1 or > 500 ||
            ids.Any(id => id == Guid.Empty) ||
            ids.Distinct().Count() != ids.Length ||
            !ids.SequenceEqual(ids.OrderBy(x => x)))
            throw new InvalidOperationException("Invalid sorted Evaluation row identity.");
        return ids;
    }

    private static string MetricRubric(string json)
    {
        using var metrics = JsonDocument.Parse(json);
        var version = metrics.RootElement.GetProperty("RubricVersion").GetString();
        if (string.IsNullOrWhiteSpace(version))
            throw new InvalidOperationException("Rubric lineage missing.");
        return version;
    }
}
