using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationModelBenchmarkRecord
{
    public Guid Id { get; set; }
    public Guid ProposalId { get; set; }
    public Guid EvaluatedByAccountId { get; set; }
    public string ProtocolVersion { get; set; } = "";
    public string ModelVersion { get; set; } = "";
    public string BaselineVersion { get; set; } = "";
    public string CandidateVersion { get; set; } = "";
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

public sealed class AllocationModelBenchmarkConflictException(string message)
    : Exception(message) { }

public sealed class AllocationModelBenchmarkService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<AllocationModelBenchmarkRecord> EvaluateAsync(
        Guid actor,
        Guid proposalId,
        IReadOnlyList<Guid> evaluationLabelIds,
        DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ArgumentNullException.ThrowIfNull(evaluationLabelIds);
        var labelIds = evaluationLabelIds.OrderBy(x => x).ToArray();
        if (proposalId == Guid.Empty ||
            labelIds.Length is < 1 or > 500 ||
            labelIds.Any(x => x == Guid.Empty) ||
            labelIds.Distinct().Count() != labelIds.Length)
            throw new ArgumentException(
                "Proposal and 1–500 distinct evaluation labels are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero ||
            cutoffUtc > clock.UtcNow)
            throw new ArgumentException(
                "A past UTC benchmark cutoff is required.");

        var proposal = await db.Proposals.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == proposalId, ct)
            ?? throw new ArgumentException("Proposal does not exist.");

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

        var snapshotIds = labels.Select(x => x.SnapshotId).ToArray();
        var snapshots = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (snapshots.Count != snapshotIds.Distinct().Count())
            throw new ArgumentException(
                "Benchmark assessment snapshots are incomplete.");

        var rows = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, rows, ct);
        if (lineage.Count != rows.Length)
            throw new ArgumentException(
                "Benchmark labels require valid first-party runtime lineage.");

        var lineages = rows.Select(x => lineage[x.Id]).ToArray();
        var baseline = lineages[0].Baseline;
        if (baseline.Version != proposal.BaselineVersion ||
            rows.Any(x =>
                x.FormulaVersion != baseline.Version ||
                x.DatasetVersion != proposal.DatasetVersion ||
                x.SourceInstructionReference !=
                    proposal.SourceInstructionReference) ||
            lineages.Any(x =>
                x.RuntimeProposalId != lineages[0].RuntimeProposalId ||
                x.RuntimeProfileSequence != lineages[0].RuntimeProfileSequence ||
                x.Baseline != baseline))
            throw new ArgumentException(
                "Benchmark labels must match one proposal baseline lineage, dataset and funding instruction.");

        var candidate = JsonSerializer.Deserialize<AllocationWeightProfile>(
            proposal.WeightsJson)
            ?? throw new InvalidOperationException(
                "Proposal candidate weights are invalid.");
        if (candidate.Version != proposal.CandidateVersion)
            throw new InvalidOperationException(
                "Proposal candidate version does not match its weights.");

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

        var metrics = AllocationModelBenchmarkEvaluator.Evaluate(
            examples, baseline, candidate, cutoffUtc);
        var id = BenchmarkId(
            proposalId,
            metrics.EvaluationFingerprint,
            AllocationModelBenchmarkEvaluator.ProtocolVersion);

        var existing = await db.ModelBenchmarks.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (existing is not null)
        {
            if (existing.ProposalId != proposalId ||
                existing.EvaluatedByAccountId != actor ||
                existing.EvaluationFingerprint !=
                    metrics.EvaluationFingerprint ||
                existing.CutoffUtc != cutoffUtc)
                throw new AllocationModelBenchmarkConflictException(
                    "Benchmark identity was reused with different input.");
            return existing;
        }

        var row = new AllocationModelBenchmarkRecord
        {
            Id = id,
            ProposalId = proposalId,
            EvaluatedByAccountId = actor,
            ProtocolVersion =
                AllocationModelBenchmarkEvaluator.ProtocolVersion,
            ModelVersion = proposal.ModelVersion,
            BaselineVersion = baseline.Version,
            CandidateVersion = candidate.Version,
            DatasetVersion = proposal.DatasetVersion,
            SourceInstructionReference =
                proposal.SourceInstructionReference,
            RuntimeProposalId = lineages[0].RuntimeProposalId,
            RuntimeProfileSequence =
                lineages[0].RuntimeProfileSequence,
            EvaluationLabelIdsJson = JsonSerializer.Serialize(labelIds),
            EvaluationFingerprint = metrics.EvaluationFingerprint,
            MetricsJson = JsonSerializer.Serialize(metrics),
            CutoffUtc = cutoffUtc,
            RecordedAtUtc = clock.UtcNow
        };
        db.ModelBenchmarks.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException
                { SqlState: "23505" })
        {
            var replay = await db.ModelBenchmarks.AsNoTracking()
                .SingleAsync(x => x.Id == id, ct);
            return replay;
        }

        return row;
    }

    internal static Guid BenchmarkId(
        Guid proposalId,
        string evaluationFingerprint,
        string protocolVersion)
    {
        if (proposalId == Guid.Empty ||
            string.IsNullOrWhiteSpace(evaluationFingerprint) ||
            string.IsNullOrWhiteSpace(protocolVersion))
            throw new ArgumentException(
                "Complete benchmark identity input is required.");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{protocolVersion}|{proposalId:D}|{evaluationFingerprint}"));
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
