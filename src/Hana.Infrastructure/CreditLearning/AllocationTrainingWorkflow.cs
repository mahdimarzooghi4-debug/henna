using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

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
    public DateTimeOffset CutoffUtc { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

/// <summary>Authorized experimental workflow. No live activation.</summary>
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
        CancellationToken ct = default)
    {
        await RequireAdmin(requester, ct);
        ArgumentNullException.ThrowIfNull(labelIds);
        var ids = labelIds.OrderBy(x => x).ToArray();
        if (ids.Length is < 40 or > 500 || ids.Any(x => x == Guid.Empty) ||
            ids.Distinct().Count() != ids.Length || poolRial <= 0 ||
            cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("Distinct reviewed labels, a positive pool and past UTC cutoff are required.");
        var labels = await db.NeedLabels.AsNoTracking().Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.Id).ToArrayAsync(ct);
        if (labels.Length != ids.Length || labels.Any(x => x.ReviewedAtUtc > cutoffUtc))
            throw new ArgumentException("Labels must exist and precede the cutoff.");
        var snapshotIds = labels.Select(x => x.SnapshotId).ToArray();
        var snapshots = await db.Assessments.AsNoTracking().Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        var rows = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        if (rows.Any(x => x.RecordedByAccountId is not null || x.EvidenceReference is not null))
            throw new ArgumentException(
                "Only first-party Henna snapshots recorded inside the platform are training-eligible.");
        var baseline = AllocationWeightProfile.Baseline;
        if (rows.Any(x => x.FormulaVersion != baseline.Version) ||
            rows.Select(x => x.DatasetVersion).Distinct().Count() != 1 ||
            rows.Select(x => x.SourceInstructionReference).Distinct().Count() != 1)
            throw new ArgumentException("Training must use one supported baseline, dataset and funding instruction.");
        var examples = labels.Select(x => {
            var s = snapshots[x.SnapshotId];
            return new ReviewedNeedExample(s.HouseholdKey,
                new(s.Health, s.Hardship, s.Age, s.Size, s.Care, s.Education), x.NeedScore,
                x.ReviewerAccountId, x.RubricVersion, x.ReviewedAtUtc, (LearningPartition)x.Partition);
        }).ToArray();
        // The run freezes actual labels/features, including their review identities and IDs.
        var run = new AllocationTrainingRunRecord { Id = Guid.NewGuid(), RequestedByAccountId = requester,
            DatasetVersion = rows[0].DatasetVersion, ModelVersion = ExperimentalAllocationWeightLearner.ModelVersion,
            InputsJson = JsonSerializer.Serialize(new { engine = "HENNA_OWNED_LOCAL",
                networkModelApi = false, dataOrigin = "HENNA_FIRST_PARTY",
                labelIds = ids, snapshotIds, examples, baseline, poolRial,
                sourceInstructionReference = rows[0].SourceInstructionReference }),
            CutoffUtc = cutoffUtc, RecordedAtUtc = clock.UtcNow };
        LearnedAllocationWeights learned;
        try { learned = ExperimentalAllocationWeightLearner.Train(examples, baseline, cutoffUtc, ct); }
        catch (InvalidOperationException)
        {
            run.Status = "NO_IMPROVEMENT";
            db.TrainingRuns.Add(run);
            await db.SaveChangesAsync(ct);
            return run;
        }
        // Candidate, simulation and training audit commit together or all roll back.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        run.ProposalId = await proposals.SubmitAsync(requester, learned.Candidate, run.ModelVersion,
            "Experimental learner: held-out error improved; requires independent human review.",
            snapshotIds, poolRial, rows[0].DatasetVersion, rows[0].SourceInstructionReference, ct);
        run.Status = "PROPOSED";
        run.MetricsJson = JsonSerializer.Serialize(learned.Metrics);
        db.TrainingRuns.Add(run);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return run;
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty || !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Explicit administrator assignment required.");
    }
}
