using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Read-only, independent evidence inventory for observed essential-needs coverage.
/// Never represents severity of need, a numeric need label or an admitted training
/// dataset; zero coverage is a valid reviewed observation, null is unknown.
/// </summary>
public sealed record AllocationEssentialNeedsCoverageInventoryPreview(
    string ManifestContractVersion,
    string SourceFormulaVersion,
    string SourceDatasetVersion,
    string SourceInstructionReference,
    DateTimeOffset CutoffUtc,
    int ReviewedCoverageObservationCount,
    string Sha256,
    string AdmissionStatus);

public sealed class AllocationEssentialNeedsCoverageInventoryService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public const string ManifestContractVersion =
        "HENNA-ESSENTIAL-NEEDS-COVERAGE-EVIDENCE-INVENTORY-v1";
    public const string NotAdmittedStatus =
        "OBSERVED_COVERAGE_ONLY_NOT_NEED_SEVERITY_LABEL";

    /// <summary>
    /// Require explicit selected event IDs. No latest-event selection,
    /// automatic severity inference, cohort discovery, dataset creation or AI
    /// activation. The 1..500 range is request-size protection, not a score
    /// threshold or minimum dataset sample policy.
    /// </summary>
    public async Task<AllocationEssentialNeedsCoverageInventoryPreview> PreviewAsync(
        Guid actor, IReadOnlyList<Guid> eventIds, DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator access is required to inspect coverage evidence.");
        ArgumentNullException.ThrowIfNull(eventIds);
        if (eventIds.Count is < 1 or > 500 ||
            eventIds.Any(x => x == Guid.Empty) ||
            eventIds.Distinct().Count() != eventIds.Count)
            throw new ArgumentException(
                "Explicit, bounded and distinct outcome event IDs are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("A non-future UTC cutoff is required.");

        var ids = eventIds.OrderBy(id => id).ToArray();
        var outcomes = await db.Outcomes.AsNoTracking()
            .Where(o => ids.Contains(o.Id))
            .OrderBy(o => o.Id)
            .ToArrayAsync(ct);
        if (outcomes.Length != ids.Length ||
            outcomes.Any(o =>
                o.Evidence != (int)AllocationOutcomeEvidence.HumanReviewed ||
                o.CreditUsedRial is not null ||
                o.EssentialNeedsCoverage is null ||
                o.EssentialNeedsCoverage is < 0m or > 1m ||
                (o.ReviewedByAccountId is null ||
                    o.ReviewedByAccountId == Guid.Empty) ||
                string.IsNullOrWhiteSpace(o.EvidenceReference) ||
                o.PeriodStartUtc.Offset != TimeSpan.Zero ||
                o.PeriodEndUtc.Offset != TimeSpan.Zero ||
                o.RecordedAtUtc.Offset != TimeSpan.Zero ||
                o.PeriodStartUtc >= o.PeriodEndUtc ||
                o.PeriodEndUtc > cutoffUtc || o.RecordedAtUtc > cutoffUtc))
            throw new ArgumentException(
                "Selected outcomes must be completed, independently reviewed essential-needs coverage, with nonempty evidence and cutoff lineage.");

        var snapshotIds = outcomes.Select(o => o.SnapshotId).ToArray();
        if (snapshotIds.Distinct().Count() != snapshotIds.Length)
            throw new ArgumentException(
                "Multiple coverage observations of a snapshot require an explicit resolution policy.");
        var snapshots = await db.Assessments.AsNoTracking()
            .Where(s => snapshotIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);
        if (snapshots.Count != outcomes.Length ||
            snapshots.Values.Any(s => s.AssessedAtUtc > cutoffUtc) ||
            snapshots.Values.Select(s => s.HouseholdKey).Distinct().Count() != outcomes.Length)
            throw new ArgumentException(
                "Every reviewed outcome needs one unique, completed source household snapshot.");

        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, snapshots.Values.ToArray(), ct);
        if (lineage.Count != outcomes.Length)
            throw new ArgumentException(
                "Selected coverage evidence has invalid first-party runtime lineage.");
        var first = snapshots[outcomes[0].SnapshotId];
        var firstLineage = lineage[first.Id];
        var manifestRows = new List<object>(outcomes.Length);
        foreach (var outcome in outcomes)
        {
            var source = snapshots[outcome.SnapshotId];
            if (outcome.PeriodStartUtc < source.AssessedAtUtc ||
                source.FormulaVersion != first.FormulaVersion ||
                source.DatasetVersion != first.DatasetVersion ||
                source.SourceInstructionReference != first.SourceInstructionReference ||
                source.RuntimeProposalId != first.RuntimeProposalId ||
                source.RuntimeProfileSequence != first.RuntimeProfileSequence ||
                lineage[source.Id].Baseline != firstLineage.Baseline)
                throw new ArgumentException(
                    "Coverage observations cannot mix source versions, funding, runtime lineage or pre-allocation periods.");
            manifestRows.Add(new
            {
                outcome.Id, outcome.SnapshotId, source.HouseholdKey,
                source.FormulaVersion, source.DatasetVersion,
                source.SourceInstructionReference, source.RuntimeProposalId,
                source.RuntimeProfileSequence,
                outcome.PeriodStartUtc, outcome.PeriodEndUtc,
                outcome.RecordedAtUtc, outcome.ReviewedByAccountId,
                outcome.EvidenceReference, outcome.EssentialNeedsCoverage,
                outcome.StockBarrier, outcome.DeliveryBarrier, outcome.AccessBarrier
            });
        }
        var canonical = JsonSerializer.Serialize(new
        {
            contract = ManifestContractVersion,
            target = "ESSENTIAL_NEEDS_COVERAGE_OBSERVED",
            cutoffUtc,
            rows = manifestRows
        });
        var digest = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(canonical)))
            .ToLowerInvariant();
        return new(ManifestContractVersion, first.FormulaVersion,
            first.DatasetVersion, first.SourceInstructionReference,
            cutoffUtc, outcomes.Length, digest, NotAdmittedStatus);
    }
}
