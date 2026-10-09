using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Independently human-reviewed, first-party-bound seven-feature observation.
/// This record is NOT a numeric need label and is never automatically included
/// in the old six-feature training pipeline or a live Commerce allocation.
/// </summary>
public sealed class AllocationReviewedSevenFactorRecord
{
    public Guid Id { get; set; }
    public Guid SnapshotId { get; set; }
    public Guid ReviewerAccountId { get; set; }
    public string FormulaVersion { get; set; } = "";
    public string SourceFormulaVersion { get; set; } = "";
    public string SourceDatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public int Health { get; set; }
    public int NonHousingHardship { get; set; }
    public int Age { get; set; }
    public int Size { get; set; }
    public int Care { get; set; }
    public int Education { get; set; }
    public int HousingTenure { get; set; }
    public string HousingEvidenceReference { get; set; } = "";
    public string NonHousingHardshipEvidenceReference { get; set; } = "";
    public string OtherNeedsEvidenceReference { get; set; } = "";
    public decimal OriginalGeographicFactor { get; set; }
    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public sealed record AllocationReviewedSevenFactorInput(
    Guid ReviewId, Guid SnapshotId,
    int Health, int NonHousingHardship, int Age,
    int Size, int Care, int Education,
    HouseholdHousingTenure HousingTenure,
    string HousingEvidenceReference,
    string NonHousingHardshipEvidenceReference,
    string OtherNeedsEvidenceReference);

public sealed class AllocationSevenFactorReviewConflictException()
    : Exception("Seven-factor review identity was reused with different reviewed evidence.");

/// <summary>
/// Reviewer-only append-only intake. Rejects unsupported/unknown housing,
/// missing independent non-housing hardship evidence, stale/non-first-party
/// allocation lineage and changes to a replayed ReviewId.
/// Does not alter historical snapshots, generate training labels, create a
/// proposal, or grant money.
/// </summary>
public sealed class AllocationReviewedSevenFactorService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public async Task<bool> RecordAsync(
        Guid reviewer, AllocationReviewedSevenFactorInput input,
        CancellationToken ct = default)
    {
        if (reviewer == Guid.Empty ||
            !await roles.HasRoleAsync(reviewer, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator review permission is required.");
        ArgumentNullException.ThrowIfNull(input);
        if (input.ReviewId == Guid.Empty || input.SnapshotId == Guid.Empty)
            throw new ArgumentException("A unique review and real snapshot are required.");

        var scores = new HouseholdNeedScores(
            input.Health, input.NonHousingHardship, input.Age,
            input.Size, input.Care, input.Education);
        var housing = new HouseholdHousingTenureEvidence(
            input.SnapshotId, input.HousingTenure,
            input.HousingEvidenceReference);
        var otherEvidence = RequireEvidence(
            input.OtherNeedsEvidenceReference, nameof(input.OtherNeedsEvidenceReference));
        var hardshipEvidence = RequireEvidence(
            input.NonHousingHardshipEvidenceReference,
            nameof(input.NonHousingHardshipEvidenceReference));

        var snapshot = await db.Assessments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == input.SnapshotId, ct)
            ?? throw new ArgumentException("Allocation source snapshot is missing.");
        var eligible = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, new[] { snapshot }, ct);
        if (!eligible.ContainsKey(snapshot.Id))
            throw new ArgumentException(
                "Review requires an authentic first-party allocation snapshot with valid runtime lineage.");

        var now = clock.UtcNow;
        if (now.Offset != TimeSpan.Zero || snapshot.AssessedAtUtc > now)
            throw new ArgumentException("Reviews require a completed UTC source assessment.");

        // The approved v1.1 Domain contract checks evidence and formula,
        // including mandatory separation of rent/housing from hardship.
        var reviewed = new HouseholdSevenFactorAssessmentV11(
            snapshot.HouseholdKey, snapshot.Id, scores, housing,
            hardshipEvidence, snapshot.GeographicFactor);
        _ = NeedsBasedAllocationV11.CalculateHouseholdFactor(reviewed);

        var record = new AllocationReviewedSevenFactorRecord
        {
            Id = input.ReviewId,
            SnapshotId = snapshot.Id,
            ReviewerAccountId = reviewer,
            FormulaVersion = NeedsBasedAllocationV11.FormulaVersion,
            SourceFormulaVersion = snapshot.FormulaVersion,
            SourceDatasetVersion = snapshot.DatasetVersion,
            SourceInstructionReference = snapshot.SourceInstructionReference,
            Health = scores.Health,
            NonHousingHardship = scores.EconomicHardship,
            Age = scores.AgeAndDependency,
            Size = scores.HouseholdSize,
            Care = scores.CareAndSupport,
            Education = scores.Education,
            HousingTenure = (int)housing.Tenure,
            HousingEvidenceReference = housing.EvidenceReference,
            NonHousingHardshipEvidenceReference = hardshipEvidence,
            OtherNeedsEvidenceReference = otherEvidence,
            OriginalGeographicFactor = snapshot.GeographicFactor,
            ReviewedAtUtc = now
        };
        var added = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO allocation_learning.reviewed_seven_factor_assessments
            ("Id","SnapshotId","ReviewerAccountId","FormulaVersion",
             "SourceFormulaVersion","SourceDatasetVersion","SourceInstructionReference",
             "Health","NonHousingHardship","Age","Size","Care","Education","HousingTenure",
             "HousingEvidenceReference","NonHousingHardshipEvidenceReference",
             "OtherNeedsEvidenceReference","OriginalGeographicFactor","ReviewedAtUtc")
            VALUES
            ({record.Id},{record.SnapshotId},{record.ReviewerAccountId},
             {record.FormulaVersion},{record.SourceFormulaVersion},
             {record.SourceDatasetVersion},{record.SourceInstructionReference},
             {record.Health},{record.NonHousingHardship},{record.Age},{record.Size},
             {record.Care},{record.Education},{record.HousingTenure},
             {record.HousingEvidenceReference},{record.NonHousingHardshipEvidenceReference},
             {record.OtherNeedsEvidenceReference},{record.OriginalGeographicFactor},
             {record.ReviewedAtUtc})
            ON CONFLICT ("Id") DO NOTHING
            """, ct);
        if (added == 1) return true;

        var existing = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .SingleAsync(x => x.Id == input.ReviewId, ct);
        if (!SameAcceptedReview(existing, record))
            throw new AllocationSevenFactorReviewConflictException();
        return false;
    }

    private static bool SameAcceptedReview(AllocationReviewedSevenFactorRecord a,
        AllocationReviewedSevenFactorRecord b) =>
        a.Id == b.Id && a.SnapshotId == b.SnapshotId &&
        a.ReviewerAccountId == b.ReviewerAccountId &&
        a.FormulaVersion == b.FormulaVersion &&
        a.SourceFormulaVersion == b.SourceFormulaVersion &&
        a.SourceDatasetVersion == b.SourceDatasetVersion &&
        a.SourceInstructionReference == b.SourceInstructionReference &&
        a.Health == b.Health &&
        a.NonHousingHardship == b.NonHousingHardship &&
        a.Age == b.Age && a.Size == b.Size && a.Care == b.Care &&
        a.Education == b.Education && a.HousingTenure == b.HousingTenure &&
        a.HousingEvidenceReference == b.HousingEvidenceReference &&
        a.NonHousingHardshipEvidenceReference == b.NonHousingHardshipEvidenceReference &&
        a.OtherNeedsEvidenceReference == b.OtherNeedsEvidenceReference &&
        a.OriginalGeographicFactor == b.OriginalGeographicFactor;

    private static string RequireEvidence(string? reference, string field)
    {
        if (string.IsNullOrWhiteSpace(reference) || reference.Length > 240)
            throw new ArgumentException(
                "An attributable reviewed evidence reference is required.", field);
        return reference.Trim();
    }
}
