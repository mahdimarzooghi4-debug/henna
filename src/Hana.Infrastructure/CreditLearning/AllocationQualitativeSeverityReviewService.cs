using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// First-party-bound, append-only human assessment. NOT a ReviewedNeedLabel,
/// DatasetVersion, training input, allocation proposal or Production event.
/// </summary>
public sealed class AllocationQualitativeSeverityReviewRecord
{
    public Guid Id { get; set; }
    public Guid SevenFactorReviewId { get; set; }
    public Guid SnapshotId { get; set; }
    public Guid ReviewerAccountId { get; set; }
    public string ScaleVersion { get; set; } = "";
    public string CriteriaVersion { get; set; } = "";
    public string SourceFormulaVersion { get; set; } = "";
    public string SourceDatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public int EvidenceDisposition { get; set; }
    public int? SeverityLevel { get; set; }
    public int? HumanSelectedBasis { get; set; }
    public string EvidenceReference { get; set; } = "";
    public DateTimeOffset EvidenceObservedAtUtc { get; set; }
    public string Rationale { get; set; } = "";
    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public sealed record AllocationQualitativeSeverityReviewInput(
    Guid Id, Guid SevenFactorReviewId,
    NeedSeverityEvidenceDisposition Disposition,
    ReviewedNeedSeverityLevel? Level,
    ReviewedNeedSeverityQualitativeBasis? HumanSelectedBasis,
    string EvidenceReference, DateTimeOffset EvidenceObservedAtUtc,
    string Rationale);

public sealed class AllocationQualitativeSeverityReviewConflictException()
    : Exception("Qualitative severity review replay differs from recorded actor or evidence.");

/// <summary>
/// Authorized human selections only; claims in external evidence references
/// are NOT trusted simply because the caller supplied an identifier.
/// </summary>
public sealed class AllocationQualitativeSeverityReviewService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public async Task<bool> RecordAsync(Guid reviewer,
        AllocationQualitativeSeverityReviewInput input, CancellationToken ct = default)
    {
        if (reviewer == Guid.Empty ||
            !await roles.HasRoleAsync(reviewer, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Authorized human administrator review required.");
        ArgumentNullException.ThrowIfNull(input);
        if (input.Id == Guid.Empty || input.SevenFactorReviewId == Guid.Empty)
            throw new ArgumentException("An immutable review ID and reviewed v1.1 input are required.");
        var selected = new ReviewedNeedSeverityQualitativeRubricV1(
            new ReviewedNeedSeverityScaleJudgment(input.Disposition, input.Level),
            input.HumanSelectedBasis);

        var seven = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == input.SevenFactorReviewId, ct)
            ?? throw new ArgumentException("The reviewed seven-feature source does not exist.");
        var snapshot = await db.Assessments.AsNoTracking()
            .SingleOrDefaultAsync(s => s.Id == seven.SnapshotId, ct)
            ?? throw new ArgumentException("Original source assessment does not exist.");
        var trustedLineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, new[] { snapshot }, ct);
        if (!trustedLineage.ContainsKey(snapshot.Id) ||
            seven.FormulaVersion != NeedsBasedAllocationV11.FormulaVersion ||
            seven.SourceFormulaVersion != snapshot.FormulaVersion ||
            seven.SourceDatasetVersion != snapshot.DatasetVersion ||
            seven.SourceInstructionReference != snapshot.SourceInstructionReference ||
            seven.OriginalGeographicFactor != snapshot.GeographicFactor)
            throw new ArgumentException("Stale or ineligible first-party reviewed source lineage.");

        var now = clock.UtcNow;
        var humanEvidence = new ReviewedNeedSeverityEvidenceV1(
            seven.Id, reviewer, input.EvidenceObservedAtUtc, now,
            input.EvidenceReference, input.Rationale, selected.Judgment);
        if (snapshot.AssessedAtUtc > now ||
            humanEvidence.EvidenceObservedAtUtc > snapshot.AssessedAtUtc ||
            seven.ReviewedAtUtc > now)
            throw new ArgumentException("Severity evidence must precede the original allocation assessment.");

        var row = new AllocationQualitativeSeverityReviewRecord
        {
            Id = input.Id,
            SevenFactorReviewId = seven.Id,
            SnapshotId = snapshot.Id,
            ReviewerAccountId = reviewer,
            ScaleVersion = ReviewedNeedSeverityScaleJudgment.ScaleVersion,
            CriteriaVersion = ReviewedNeedSeverityQualitativeRubricV1.Version,
            SourceFormulaVersion = snapshot.FormulaVersion,
            SourceDatasetVersion = snapshot.DatasetVersion,
            SourceInstructionReference = snapshot.SourceInstructionReference,
            EvidenceDisposition = (int)selected.Judgment.EvidenceDisposition,
            SeverityLevel = selected.Judgment.Level is { } level ? (int)level : null,
            HumanSelectedBasis = selected.HumanSelectedBasis is { } basis ? (int)basis : null,
            EvidenceReference = humanEvidence.EvidenceReference,
            // PostgreSQL timestamptz is microsecond-precise; bind replay identity
            // to that exact persisted UTC precision, never to unused .NET ticks.
            EvidenceObservedAtUtc = humanEvidence.EvidenceObservedAtUtc.AddTicks(
                -(humanEvidence.EvidenceObservedAtUtc.Ticks % 10)),
            Rationale = humanEvidence.Rationale,
            ReviewedAtUtc = now
        };
        var added = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO allocation_learning.qualitative_severity_reviews
            ("Id","SevenFactorReviewId","SnapshotId","ReviewerAccountId",
             "ScaleVersion","CriteriaVersion","SourceFormulaVersion",
             "SourceDatasetVersion","SourceInstructionReference",
             "EvidenceDisposition","SeverityLevel","HumanSelectedBasis",
             "EvidenceReference","EvidenceObservedAtUtc","Rationale","ReviewedAtUtc")
            VALUES
            ({row.Id},{row.SevenFactorReviewId},{row.SnapshotId},{row.ReviewerAccountId},
             {row.ScaleVersion},{row.CriteriaVersion},{row.SourceFormulaVersion},
             {row.SourceDatasetVersion},{row.SourceInstructionReference},
             {row.EvidenceDisposition},{row.SeverityLevel},{row.HumanSelectedBasis},
             {row.EvidenceReference},{row.EvidenceObservedAtUtc},
             {row.Rationale},{row.ReviewedAtUtc})
            ON CONFLICT ("Id") DO NOTHING
            """, ct);
        if (added == 1) return true;

        var old = await db.QualitativeSeverityReviews.AsNoTracking()
            .SingleAsync(r => r.Id == input.Id, ct);
        if (old.SevenFactorReviewId != row.SevenFactorReviewId ||
            old.SnapshotId != row.SnapshotId ||
            old.ReviewerAccountId != row.ReviewerAccountId ||
            old.ScaleVersion != row.ScaleVersion ||
            old.CriteriaVersion != row.CriteriaVersion ||
            old.SourceFormulaVersion != row.SourceFormulaVersion ||
            old.SourceDatasetVersion != row.SourceDatasetVersion ||
            old.SourceInstructionReference != row.SourceInstructionReference ||
            old.EvidenceDisposition != row.EvidenceDisposition ||
            old.SeverityLevel != row.SeverityLevel ||
            old.HumanSelectedBasis != row.HumanSelectedBasis ||
            old.EvidenceReference != row.EvidenceReference ||
            old.EvidenceObservedAtUtc != row.EvidenceObservedAtUtc ||
            old.Rationale != row.Rationale)
            throw new AllocationQualitativeSeverityReviewConflictException();
        return false;
    }
}
