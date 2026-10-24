using System.Data;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record ResearchModelEvaluationEvidence(
    Guid Id, string ProtocolVersion, string EvaluationFingerprint,
    string DatasetVersion, string SourceInstructionReference,
    DateTimeOffset CutoffUtc, DateTimeOffset RecordedAtUtc);

public sealed record ResearchModelArtifactDossier(
    string ContractVersion, string Family, Guid ArtifactId, Guid TrainingRunId,
    string ModelVersion, string ArtifactFormat, string ArtifactSha256,
    string DatasetVersion, DateTimeOffset RecordedAtUtc,
    bool ArtifactVerified, IReadOnlyList<ResearchModelEvaluationEvidence> Evaluations,
    string EvidenceStatus, bool Registered, bool Approved, bool Active, bool RuntimeApplied);

/// <summary>
/// Read-only evidence dossier from a consistent PostgreSQL snapshot.
/// Does not admit data, register models, or authorize Production.
/// </summary>
public sealed class AllocationModelArtifactDossierService(HanaAllocationLearningDbContext db)
{
    public const string ContractVersion = "HENNA-RESEARCH-ARTIFACT-EVIDENCE-DOSSIER-v1";
    public const string EvidenceStatus = "RESEARCH_EVIDENCE_ONLY_NOT_APPROVED";

    public async Task<ResearchModelArtifactDossier?> ReadAsync(
        string family, Guid artifactId, CancellationToken ct = default)
    {
        if (artifactId == Guid.Empty || (family != "XGBOOST" && family != "EBM"))
            throw new ArgumentException("Supported existing research artifact required.");
        await using var snapshot = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        ResearchModelArtifactDossier result;
        if (family == "XGBOOST")
        {
            var run = await db.TrainingRuns.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == artifactId, ct);
            if (run is null) return null;
            var benchmarks = await db.ShadowModelBenchmarks.AsNoTracking()
                .Where(x => x.TrainingRunId == artifactId)
                .OrderBy(x => x.Id).Take(101).ToArrayAsync(ct);
            result = BuildXgboost(run, benchmarks);
        }
        else
        {
            var artifact = await db.EbmArtifacts.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == artifactId, ct);
            if (artifact is null) return null;
            var run = await db.TrainingRuns.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == artifact.TrainingRunId, ct)
                ?? throw new InvalidOperationException("Orphaned EBM research artifact.");
            var benchmarks = await db.EbmModelBenchmarks.AsNoTracking()
                .Where(x => x.EbmArtifactId == artifactId)
                .OrderBy(x => x.Id).Take(101).ToArrayAsync(ct);
            result = BuildEbm(artifact, run, benchmarks);
        }
        await snapshot.CommitAsync(ct);
        return result;
    }

    public static ResearchModelArtifactDossier BuildXgboost(
        AllocationTrainingRunRecord run,
        IReadOnlyList<AllocationShadowModelBenchmarkRecord> benchmarks)
    {
        ArgumentNullException.ThrowIfNull(run);
        ArgumentNullException.ThrowIfNull(benchmarks);
        if (run.Id == Guid.Empty ||
            run.ShadowModelVersion != HennaXGBoostOfflineLearner.ModelVersion ||
            run.ShadowArtifactFormat != HennaXGBoostOfflineLearner.ArtifactFormat ||
            !AllocationModelArtifactAttestation.Matches(run.ShadowArtifactBytes, run.ShadowArtifactSha256) ||
            string.IsNullOrWhiteSpace(run.DatasetVersion))
            throw new InvalidOperationException("Unverified XGBoost research artifact.");
        return Make("XGBOOST", run.Id, run.Id, run.ShadowModelVersion,
            run.ShadowArtifactFormat, run.ShadowArtifactSha256!, run.DatasetVersion,
            run.RecordedAtUtc,
            ReadEvidence(benchmarks.Select(x => new EvidenceRow(
                x.Id, x.TrainingRunId, x.ArtifactSha256, x.ModelVersion,
                x.ProtocolVersion, x.EvaluationFingerprint, x.DatasetVersion,
                x.SourceInstructionReference, x.CutoffUtc, x.RecordedAtUtc)),
                run.Id, run.ShadowArtifactSha256!, run.ShadowModelVersion, run.DatasetVersion));
    }

    public static ResearchModelArtifactDossier BuildEbm(
        AllocationEbmArtifactRecord artifact, AllocationTrainingRunRecord run,
        IReadOnlyList<AllocationEbmBenchmarkRecord> benchmarks)
    {
        ArgumentNullException.ThrowIfNull(artifact);
        ArgumentNullException.ThrowIfNull(run);
        ArgumentNullException.ThrowIfNull(benchmarks);
        if (artifact.Id == Guid.Empty || run.Id == Guid.Empty ||
            artifact.TrainingRunId != run.Id ||
            artifact.ModelVersion != HennaEbmPortableArtifactVerifier.ModelVersion ||
            artifact.ArtifactFormat != HennaEbmPortableArtifactVerifier.ArtifactFormat ||
            !AllocationModelArtifactAttestation.Matches(artifact.ArtifactBytes, artifact.ArtifactSha256) ||
            string.IsNullOrWhiteSpace(run.DatasetVersion) ||
            benchmarks.Any(x => x.EbmArtifactId != artifact.Id))
            throw new InvalidOperationException("Unverified EBM research artifact or evaluation identity.");
        return Make("EBM", artifact.Id, run.Id, artifact.ModelVersion,
            artifact.ArtifactFormat, artifact.ArtifactSha256, run.DatasetVersion,
            artifact.RecordedAtUtc,
            ReadEvidence(benchmarks.Select(x => new EvidenceRow(
                x.Id, x.TrainingRunId, x.ArtifactSha256, x.ModelVersion,
                x.ProtocolVersion, x.EvaluationFingerprint, x.DatasetVersion,
                x.SourceInstructionReference, x.CutoffUtc, x.RecordedAtUtc)),
                run.Id, artifact.ArtifactSha256, artifact.ModelVersion, run.DatasetVersion));
    }

    private sealed record EvidenceRow(
        Guid Id, Guid TrainingRunId, string ArtifactSha256, string ModelVersion,
        string ProtocolVersion, string EvaluationFingerprint, string DatasetVersion,
        string SourceInstructionReference, DateTimeOffset CutoffUtc, DateTimeOffset RecordedAtUtc);

    private static IReadOnlyList<ResearchModelEvaluationEvidence> ReadEvidence(
        IEnumerable<EvidenceRow> source, Guid runId, string sha, string version, string dataset)
    {
        var rows = source.ToArray();
        if (rows.Length > 100 || rows.Select(r => r.Id).Distinct().Count() != rows.Length ||
            rows.Any(r => r.Id == Guid.Empty || r.TrainingRunId != runId ||
                r.ArtifactSha256 != sha || r.ModelVersion != version ||
                r.DatasetVersion != dataset || string.IsNullOrWhiteSpace(r.ProtocolVersion) ||
                string.IsNullOrWhiteSpace(r.SourceInstructionReference) ||
                !IsSha(r.EvaluationFingerprint) ||
                r.CutoffUtc.Offset != TimeSpan.Zero || r.RecordedAtUtc.Offset != TimeSpan.Zero))
            throw new InvalidOperationException("Contradictory research evaluation lineage.");
        return rows.OrderBy(r => r.Id)
            .Select(r => new ResearchModelEvaluationEvidence(
                r.Id, r.ProtocolVersion, r.EvaluationFingerprint, r.DatasetVersion,
                r.SourceInstructionReference, r.CutoffUtc, r.RecordedAtUtc)).ToArray();
    }

    private static bool IsSha(string? value) =>
        value is { Length: 64 } &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static ResearchModelArtifactDossier Make(
        string family, Guid id, Guid runId, string version, string format,
        string sha, string dataset, DateTimeOffset recorded,
        IReadOnlyList<ResearchModelEvaluationEvidence> evaluations) =>
        new(ContractVersion, family, id, runId, version, format, sha, dataset,
            recorded, true, evaluations, EvidenceStatus, false, false, false, false);
}
