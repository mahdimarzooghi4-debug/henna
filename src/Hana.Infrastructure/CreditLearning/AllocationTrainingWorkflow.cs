using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Hana.Infrastructure.CreditLearning;

public sealed class ReviewedNeedLabelRecord
{
    public Guid Id { get; set; }
    public Guid SnapshotId { get; set; }
    public Guid ReviewerAccountId { get; set; }
    public decimal NeedScore { get; set; }
    public string RubricVersion { get; set; } = "";
    public int Partition { get; set; }
    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public sealed class AllocationTrainingRunRecord
{
    public Guid Id { get; set; }
    public Guid RequestedByAccountId { get; set; }
    public Guid? ProposalId { get; set; }
    public string Status { get; set; } = "";
    public string DatasetVersion { get; set; } = "";
    public string ModelVersion { get; set; } = "";
    public string InputsJson { get; set; } = "";
    public string? MetricsJson { get; set; }
    public string? ShadowModelVersion { get; set; }
    public string? ShadowArtifactFormat { get; set; }
    public string? ShadowArtifactSha256 { get; set; }
    public byte[]? ShadowArtifactBytes { get; set; }
    public string? ShadowParametersJson { get; set; }
    public string? ShadowMetricsJson { get; set; }
    public DateTimeOffset CutoffUtc { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

/// <summary>Authorized experimental workflow. No live activation.</summary>
public sealed class AllocationTrainingIdempotencyConflictException()
    : Exception("Allocation training idempotency key was reused with different input.");

public sealed class AllocationTrainingWorkflow(HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles, IClock clock, AllocationProposalService proposals)
{
    public async Task<Guid> ReviewNeedAsync(Guid reviewer, Guid snapshotId, decimal score,
        string rubricVersion, LearningPartition partition, CancellationToken ct = default)
    {
        await RequireAdmin(reviewer, ct);
        if (string.IsNullOrWhiteSpace(rubricVersion) || rubricVersion.Length > 120 ||
            score is < 0m or > 1m || !Enum.IsDefined(partition))
            throw new ArgumentException("Reviewed score, rubric and partition are required.");
        var snapshot = await db.Assessments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == snapshotId, ct);
        if (snapshot is null)
            throw new ArgumentException("Assessment snapshot is missing.");
        var eligible = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, new[] { snapshot }, ct);
        if (!eligible.ContainsKey(snapshot.Id))
            throw new ArgumentException(
                "Only first-party Henna snapshots with valid runtime lineage can receive training labels.");
        if (snapshot.AssessedAtUtc > clock.UtcNow)
            throw new ArgumentException("Assessment cannot be in the future.");
        var id = Guid.NewGuid();
        db.NeedLabels.Add(new() { Id = id, SnapshotId = snapshotId,
            ReviewerAccountId = reviewer, NeedScore = score, RubricVersion = rubricVersion,
            Partition = (int)partition, ReviewedAtUtc = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        return id;
    }

    public async Task<AllocationTrainingRunRecord> TrainAsync(Guid requester,
        IReadOnlyList<Guid> labelIds, long poolRial, DateTimeOffset cutoffUtc,
        Guid? requestId = null, CancellationToken ct = default)
    {
        await RequireAdmin(requester, ct);
        ArgumentNullException.ThrowIfNull(labelIds);
        var ids = labelIds.OrderBy(x => x).ToArray();
        if (ids.Length is < 40 or > 500 || ids.Any(x => x == Guid.Empty) ||
            ids.Distinct().Count() != ids.Length || poolRial <= 0)
            throw new ArgumentException("Distinct reviewed labels and a positive pool are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("A past UTC cutoff is required.");
        cutoffUtc = CanonicalTimestamp(cutoffUtc);

        await using var requestTransaction = requestId is not null
            ? await db.Database.BeginTransactionAsync(ct)
            : null;
        if (requestId is { } retryId)
        {
            if (retryId == Guid.Empty)
                throw new ArgumentException("Training request id is invalid.");

            // Cross-replica serialization belongs in PostgreSQL, not process
            // memory. Hold a transaction-scoped advisory lock for this
            // deterministic request identity before checking/inserting.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({TrainingRequestLockKey(retryId)})",
                ct);

            var existing = await db.TrainingRuns.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == retryId, ct);
            if (existing is not null)
            {
                if (!SameTrainingRequest(
                        existing, requester, ids, poolRial, cutoffUtc))
                    throw new AllocationTrainingIdempotencyConflictException();
                await requestTransaction.CommitAsync(ct);
                return existing;
            }
        }

        var labels = await db.NeedLabels.AsNoTracking().Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.Id).ToArrayAsync(ct);
        if (labels.Length != ids.Length || labels.Any(x => x.ReviewedAtUtc > cutoffUtc))
            throw new ArgumentException("Labels must exist and precede the cutoff.");
        if (labels.Any(x => x.Partition == (int)LearningPartition.Evaluation))
            throw new ArgumentException(
                "Independent evaluation labels cannot be used for training or candidate selection.");
        var snapshotIds = labels.Select(x => x.SnapshotId).ToArray();
        var snapshots = await db.Assessments.AsNoTracking().Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        var rows = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, rows, ct);
        if (lineage.Count != rows.Length)
            throw new ArgumentException(
                "Only first-party Henna snapshots with valid runtime lineage are training-eligible.");
        var lineages = rows.Select(x => lineage[x.Id]).ToArray();
        var baseline = lineages[0].Baseline;
        if (rows.Any(x => x.FormulaVersion != baseline.Version) ||
            lineages.Any(x =>
                x.RuntimeProposalId != lineages[0].RuntimeProposalId ||
                x.RuntimeProfileSequence != lineages[0].RuntimeProfileSequence ||
                x.Baseline != baseline) ||
            rows.Select(x => x.DatasetVersion).Distinct().Count() != 1 ||
            rows.Select(x => x.SourceInstructionReference).Distinct().Count() != 1)
            throw new ArgumentException(
                "Training must use one runtime lineage, dataset and funding instruction.");
        var examples = labels.Select(x => {
            var s = snapshots[x.SnapshotId];
            return new ReviewedNeedExample(s.HouseholdKey,
                new(s.Health, s.Hardship, s.Age, s.Size, s.Care, s.Education), x.NeedScore,
                x.ReviewerAccountId, x.RubricVersion, x.ReviewedAtUtc, (LearningPartition)x.Partition);
        }).ToArray();
        // XGBoost starts learning now, but remains a shadow/offline artifact.
        // It has no Proposal or Runtime path in this slice.
        var shadow = HennaXGBoostOfflineLearner.Train(
            examples, cutoffUtc, ct);

        // The run freezes actual labels/features, including their review identities and IDs.
        var run = new AllocationTrainingRunRecord { Id = requestId ?? Guid.NewGuid(), RequestedByAccountId = requester,
            DatasetVersion = rows[0].DatasetVersion, ModelVersion = ExperimentalAllocationWeightLearner.ModelVersion,
            InputsJson = JsonSerializer.Serialize(new { engine = "HENNA_OWNED_LOCAL",
                networkModelApi = false, dataOrigin = "HENNA_FIRST_PARTY",
                labelIds = ids, snapshotIds, examples, baseline,
                baselineRuntimeProposalId = lineages[0].RuntimeProposalId,
                baselineRuntimeProfileSequence = lineages[0].RuntimeProfileSequence,
                poolRial,
                sourceInstructionReference = rows[0].SourceInstructionReference }),
            ShadowModelVersion = shadow.ModelVersion,
            ShadowArtifactFormat = shadow.ArtifactFormat,
            ShadowArtifactSha256 = shadow.ArtifactSha256,
            ShadowArtifactBytes = shadow.ArtifactBytes,
            ShadowParametersJson = shadow.ParametersJson,
            ShadowMetricsJson = JsonSerializer.Serialize(shadow.Metrics),
            CutoffUtc = cutoffUtc, RecordedAtUtc = clock.UtcNow };
        LearnedAllocationWeights learned;
        try { learned = ExperimentalAllocationWeightLearner.Train(examples, baseline, cutoffUtc, ct); }
        catch (InvalidOperationException)
        {
            run.Status = "NO_IMPROVEMENT";
            db.TrainingRuns.Add(run);
            await db.SaveChangesAsync(ct);
            if (requestTransaction is not null)
                await requestTransaction.CommitAsync(ct);
            return run;
        }
        // Candidate, simulation and training audit commit together or all roll back.
        var ownsProposalTransaction = requestTransaction is null;
        var transaction = requestTransaction ??
            await db.Database.BeginTransactionAsync(ct);
        try
        {
            run.ProposalId = await proposals.SubmitAsync(requester, learned.Candidate, run.ModelVersion,
            "Experimental learner: held-out error improved; requires independent human review.",
            snapshotIds, poolRial, rows[0].DatasetVersion, rows[0].SourceInstructionReference,
            baseline, ct);
            run.Status = "PROPOSED";
            run.MetricsJson = JsonSerializer.Serialize(learned.Metrics);
            db.TrainingRuns.Add(run);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return run;
        }
        finally
        {
            if (ownsProposalTransaction)
                await transaction.DisposeAsync();
        }
    }

    private static long TrainingRequestLockKey(Guid requestId)
    {
        Span<byte> digest = stackalloc byte[32];
        System.Security.Cryptography.SHA256.HashData(
            requestId.ToByteArray(), digest);
        return System.Buffers.Binary.BinaryPrimitives.ReadInt64LittleEndian(
            digest[..8]);
    }

    private static bool SameTrainingRequest(
        AllocationTrainingRunRecord existing,
        Guid requester,
        IReadOnlyList<Guid> sortedLabelIds,
        long poolRial,
        DateTimeOffset cutoffUtc)
    {
        if (existing.RequestedByAccountId != requester ||
            existing.CutoffUtc != cutoffUtc)
            return false;
        try
        {
            using var inputs = JsonDocument.Parse(existing.InputsJson);
            var root = inputs.RootElement;
            if (!root.TryGetProperty("poolRial", out var storedPool) ||
                storedPool.GetInt64() != poolRial ||
                !root.TryGetProperty("labelIds", out var storedLabels) ||
                storedLabels.ValueKind != JsonValueKind.Array)
                return false;
            var ids = storedLabels.EnumerateArray()
                .Select(x => x.GetGuid())
                .OrderBy(x => x)
                .ToArray();
            return ids.SequenceEqual(sortedLabelIds);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static DateTimeOffset CanonicalTimestamp(DateTimeOffset value) =>
        value.AddTicks(-(value.Ticks % 10));

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty || !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Explicit administrator assignment required.");
    }
}
