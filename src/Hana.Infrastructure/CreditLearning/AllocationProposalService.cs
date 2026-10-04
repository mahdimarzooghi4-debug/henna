using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationProposalRecord
{
    public Guid Id { get; set; }
    public Guid CreatedByAccountId { get; set; }
    public string CandidateVersion { get; set; } = "";
    public string ModelVersion { get; set; } = "";
    public string Rationale { get; set; } = "";
    public string BaselineVersion { get; set; } = "";
    public string DatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public long PoolRial { get; set; }
    public string WeightsJson { get; set; } = "";
    public string SnapshotIdsJson { get; set; } = "";
    public string SimulationJson { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class AllocationProposalReviewRecord
{
    public Guid Id { get; set; }
    public Guid ProposalId { get; set; }
    public Guid ReviewerAccountId { get; set; }
    public string Decision { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public sealed class AllocationProposalConflictException(string message) : Exception(message) { }

/// <summary>Review only. No activation, eligibility decision, or wallet mutation.</summary>
public sealed class AllocationProposalService(HanaAllocationLearningDbContext db, IClock clock)
{
    public async Task<Guid> SubmitAsync(Guid creatorAccountId, AllocationWeightProfile candidate,
        string modelVersion, string rationale, IReadOnlyList<Guid> snapshotIds, long poolRial,
        string datasetVersion, string sourceInstructionReference, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(candidate);
        ArgumentNullException.ThrowIfNull(snapshotIds);
        ValidateText(candidate.Version, 120);
        ValidateText(modelVersion, 120);
        ValidateText(rationale, 2000);
        ValidateText(datasetVersion, 120);
        ValidateText(sourceInstructionReference, 120);
        var ids = snapshotIds.OrderBy(x => x).ToArray();
        if (creatorAccountId == Guid.Empty || poolRial <= 0 || ids.Length is < 1 or > 500 ||
            ids.Any(x => x == Guid.Empty) || ids.Distinct().Count() != ids.Length)
            throw new ArgumentException("An actor, positive pool and 1–500 distinct snapshots are required.");
        var rows = await db.Assessments.AsNoTracking().Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.Id).ToListAsync(cancellationToken);
        var baseline = AllocationWeightProfile.Baseline;
        if (rows.Count != ids.Length || rows.Any(x => x.FormulaVersion != baseline.Version ||
            x.DatasetVersion != datasetVersion || x.SourceInstructionReference != sourceInstructionReference))
            throw new ArgumentException("Snapshots must match the supported baseline, dataset and funding instruction.");
        var cases = rows.Select(x => new AllocationLearningCase(x.HouseholdKey,
            new(x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education), x.GeographicFactor)).ToArray();
        var simulation = AllocationLearningSimulator.ComparePool(poolRial, cases, baseline, candidate,
            datasetVersion, sourceInstructionReference);
        var id = Guid.NewGuid();
        db.Proposals.Add(new AllocationProposalRecord {
            Id = id, CreatedByAccountId = creatorAccountId, CandidateVersion = candidate.Version,
            ModelVersion = modelVersion, Rationale = rationale, BaselineVersion = baseline.Version,
            DatasetVersion = datasetVersion, SourceInstructionReference = sourceInstructionReference,
            PoolRial = poolRial, WeightsJson = JsonSerializer.Serialize(candidate),
            SnapshotIdsJson = JsonSerializer.Serialize(ids), SimulationJson = JsonSerializer.Serialize(simulation),
            CreatedAtUtc = clock.UtcNow });
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: "23505" })
        { throw new AllocationProposalConflictException("Candidate version already exists."); }
        return id;
    }

    public async Task<bool> ReviewAsync(Guid proposalId, Guid reviewerAccountId, string decision,
        string reason, CancellationToken cancellationToken = default)
    {
        ValidateText(reason, 2000);
        if (reviewerAccountId == Guid.Empty || decision is not ("APPROVED" or "REJECTED"))
            throw new ArgumentException("Reviewer and an explicit review decision are required.");
        var proposal = await db.Proposals.AsNoTracking().SingleOrDefaultAsync(x => x.Id == proposalId, cancellationToken);
        if (proposal is null) return false;
        if (proposal.CreatedByAccountId == reviewerAccountId)
            throw new AllocationProposalConflictException("A second administrator must review the proposal.");
        if (await db.Reviews.AnyAsync(x => x.ProposalId == proposalId, cancellationToken))
            throw new AllocationProposalConflictException("Proposal has already been reviewed.");
        db.Reviews.Add(new AllocationProposalReviewRecord {
            Id = Guid.NewGuid(), ProposalId = proposalId, ReviewerAccountId = reviewerAccountId,
            Decision = decision, Reason = reason, ReviewedAtUtc = clock.UtcNow });
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: "23505" })
        { throw new AllocationProposalConflictException("Another administrator already reviewed this proposal."); }
        return true;
    }

    private static void ValidateText(string value, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > maximumLength)
            throw new ArgumentException($"Text must contain 1–{maximumLength} characters.");
    }
}
