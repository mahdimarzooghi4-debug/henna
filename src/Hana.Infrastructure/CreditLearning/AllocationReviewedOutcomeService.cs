using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationReviewedOutcomeConflictException()
    : Exception("Reviewed outcome event id was reused with different data.");

public sealed record AllocationReviewedOutcomeInput(
    Guid EventId,
    Guid SnapshotId,
    DateTimeOffset PeriodStartUtc,
    DateTimeOffset PeriodEndUtc,
    decimal? EssentialNeedsCoverage,
    bool? StockBarrier,
    bool? DeliveryBarrier,
    bool? AccessBarrier,
    string EvidenceReference);

/// <summary>
/// Human-reviewed, evidence-backed non-financial outcome capture.
/// It never writes credit usage, need labels, eligibility, or runtime weights.
/// </summary>
public sealed class AllocationReviewedOutcomeService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<bool> RecordAsync(
        Guid reviewer,
        AllocationReviewedOutcomeInput input,
        CancellationToken ct = default)
    {
        await RequireAdmin(reviewer, ct);
        ArgumentNullException.ThrowIfNull(input);

        if (input.EventId == Guid.Empty ||
            input.SnapshotId == Guid.Empty ||
            string.IsNullOrWhiteSpace(input.EvidenceReference) ||
            input.EvidenceReference.Length > 240)
            throw new ArgumentException(
                "Reviewed outcome requires event, snapshot and evidence reference.");
        if (input.EssentialNeedsCoverage is < 0m or > 1m)
            throw new ArgumentOutOfRangeException(
                nameof(input.EssentialNeedsCoverage));
        if (input.EssentialNeedsCoverage is null &&
            input.StockBarrier is null &&
            input.DeliveryBarrier is null &&
            input.AccessBarrier is null)
            throw new ArgumentException(
                "At least one reviewed non-financial outcome is required.");

        var now = clock.UtcNow;
        if (now.Offset != TimeSpan.Zero ||
            input.PeriodStartUtc.Offset != TimeSpan.Zero ||
            input.PeriodEndUtc.Offset != TimeSpan.Zero ||
            input.PeriodStartUtc >= input.PeriodEndUtc ||
            input.PeriodEndUtc > now)
            throw new ArgumentException(
                "A completed UTC observation interval is required.");

        var snapshot = await db.Assessments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == input.SnapshotId, ct)
            ?? throw new ArgumentException("Assessment snapshot is missing.");

        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, new[] { snapshot }, ct);
        if (!lineage.ContainsKey(snapshot.Id))
            throw new ArgumentException(
                "Reviewed outcomes require a first-party Henna snapshot with valid runtime lineage.");
        if (input.PeriodStartUtc < snapshot.AssessedAtUtc)
            throw new ArgumentException(
                "Reviewed outcome interval cannot begin before allocation assessment.");

        var periodStart = CanonicalTimestamp(input.PeriodStartUtc);
        var periodEnd = CanonicalTimestamp(input.PeriodEndUtc);
        var evidenceReference = input.EvidenceReference.Trim();
        var evidence = (int)AllocationOutcomeEvidence.HumanReviewed;

        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO allocation_learning.outcomes
            ("Id","SnapshotId","PeriodStartUtc","PeriodEndUtc",
             "CreditUsedRial","EssentialNeedsCoverage","StockBarrier",
             "DeliveryBarrier","AccessBarrier","Evidence",
             "ReviewedByAccountId","EvidenceReference","RecordedAtUtc")
            VALUES
            ({input.EventId},{input.SnapshotId},{periodStart},{periodEnd},
             {null},{input.EssentialNeedsCoverage},{input.StockBarrier},
             {input.DeliveryBarrier},{input.AccessBarrier},{evidence},
             {reviewer},{evidenceReference},{now})
            ON CONFLICT ("Id") DO NOTHING
            """, ct);

        if (inserted == 1) return true;

        var stored = await db.Outcomes.AsNoTracking()
            .SingleAsync(x => x.Id == input.EventId, ct);
        if (!SameReviewedOutcome(
                stored, reviewer, input, periodStart, periodEnd,
                evidenceReference))
            throw new AllocationReviewedOutcomeConflictException();
        return false;
    }

    private static bool SameReviewedOutcome(
        AllocationOutcomeRecord stored,
        Guid reviewer,
        AllocationReviewedOutcomeInput expected,
        DateTimeOffset periodStart,
        DateTimeOffset periodEnd,
        string evidenceReference) =>
        stored.Id == expected.EventId &&
        stored.SnapshotId == expected.SnapshotId &&
        stored.PeriodStartUtc == periodStart &&
        stored.PeriodEndUtc == periodEnd &&
        stored.CreditUsedRial is null &&
        stored.EssentialNeedsCoverage == expected.EssentialNeedsCoverage &&
        stored.StockBarrier == expected.StockBarrier &&
        stored.DeliveryBarrier == expected.DeliveryBarrier &&
        stored.AccessBarrier == expected.AccessBarrier &&
        stored.Evidence == (int)AllocationOutcomeEvidence.HumanReviewed &&
        stored.ReviewedByAccountId == reviewer &&
        stored.EvidenceReference == evidenceReference;

    private static DateTimeOffset CanonicalTimestamp(DateTimeOffset value) =>
        value.AddTicks(-(value.Ticks % 10));

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }
}
