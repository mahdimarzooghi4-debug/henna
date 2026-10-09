using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Read-only provenance preview, NOT a dataset, label-admission certificate,
/// trained model, numeric target, or eligible Production artifact.
/// </summary>
public sealed record AllocationSevenFactorReviewInventoryPreview(
    string ManifestContractVersion,
    string FormulaVersion,
    string SourceFormulaVersion,
    string SourceDatasetVersion,
    string SourceInstructionReference,
    DateTimeOffset CutoffUtc,
    int ReviewedHouseholdCount,
    string Sha256,
    string AdmissionStatus);

public sealed class AllocationSevenFactorReviewInventoryService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public const string ManifestContractVersion = "HENNA-SEVEN-FACTOR-REVIEW-INVENTORY-v1";
    public const string NotAdmittedStatus = "REVIEW_ONLY_NUMERIC_RUBRIC_REQUIRED";

    /// <summary>
    /// Explicitly selected review IDs only. Does not auto-pick between
    /// competing reviews, split datasets, train, label, or persist a manifest.
    /// A bounded batch protects the backend, not a model quality threshold.
    /// </summary>
    public async Task<AllocationSevenFactorReviewInventoryPreview> PreviewAsync(
        Guid actor, IReadOnlyList<Guid> selectedReviewIds, DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator access is required to inspect reviewed feature provenance.");

        ArgumentNullException.ThrowIfNull(selectedReviewIds);
        if (selectedReviewIds.Count is < 1 or > 500 ||
            selectedReviewIds.Any(id => id == Guid.Empty) ||
            selectedReviewIds.Distinct().Count() != selectedReviewIds.Count)
            throw new ArgumentException("A bounded list of distinct review IDs is required.");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("A non-future UTC cutoff is required.");

        // Resolve in canonical identity order so request permutation does not
        // alter the attested exact-selection digest.
        var ids = selectedReviewIds.OrderBy(id => id).ToArray();
        var reviews = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .Where(r => ids.Contains(r.Id))
            .OrderBy(r => r.Id)
            .ToArrayAsync(ct);
        if (reviews.Length != ids.Length ||
            reviews.Any(r => r.ReviewedAtUtc > cutoffUtc ||
                             r.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                             r.FormulaVersion != NeedsBasedAllocationV11.FormulaVersion))
            throw new ArgumentException(
                "Every selected review must exist, match v1.1 and precede the UTC cutoff.");

        var sourceIds = reviews.Select(r => r.SnapshotId).ToArray();
        if (sourceIds.Distinct().Count() != sourceIds.Length)
            throw new ArgumentException(
                "More than one review for a snapshot requires explicit resolution; no latest-wins policy exists.");

        var sources = await db.Assessments.AsNoTracking()
            .Where(s => sourceIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);
        if (sources.Count != reviews.Length ||
            sources.Values.Any(s => s.AssessedAtUtc > cutoffUtc))
            throw new ArgumentException(
                "Each selected reviewed record must have a valid prior source assessment.");

        if (sources.Values.Select(s => s.HouseholdKey).Distinct().Count() != reviews.Length)
            throw new ArgumentException(
                "Households with multiple snapshots cannot enter one inventory without an approved resolution policy.");

        var validated = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, sources.Values.ToArray(), ct);
        if (validated.Count != reviews.Length)
            throw new ArgumentException(
                "One or more source snapshots fail first-party runtime lineage attestation.");

        var first = sources[reviews[0].SnapshotId];
        var firstLineage = validated[first.Id];
        var manifestRows = new List<object>(reviews.Length);
        foreach (var review in reviews)
        {
            var source = sources[review.SnapshotId];
            var lineage = validated[review.SnapshotId];
            if (review.SourceFormulaVersion != source.FormulaVersion ||
                review.SourceDatasetVersion != source.DatasetVersion ||
                review.SourceInstructionReference != source.SourceInstructionReference ||
                review.OriginalGeographicFactor != source.GeographicFactor ||
                source.FormulaVersion != first.FormulaVersion ||
                source.DatasetVersion != first.DatasetVersion ||
                source.SourceInstructionReference != first.SourceInstructionReference ||
                source.RuntimeProposalId != first.RuntimeProposalId ||
                source.RuntimeProfileSequence != first.RuntimeProfileSequence ||
                lineage.Baseline != firstLineage.Baseline)
                throw new ArgumentException(
                    "Selected reviews have stale, mixed or conflicting versioned source lineage.");
            if (review.ReviewerAccountId == Guid.Empty ||
                string.IsNullOrWhiteSpace(review.OtherNeedsEvidenceReference))
                throw new ArgumentException("The review is missing its accountable evidence.");

            var scores = new HouseholdNeedScores(review.Health,
                review.NonHousingHardship, review.Age, review.Size,
                review.Care, review.Education);
            var housing = new HouseholdHousingTenureEvidence(
                review.SnapshotId, (HouseholdHousingTenure)review.HousingTenure,
                review.HousingEvidenceReference);
            var assessed = new HouseholdSevenFactorAssessmentV11(
                source.HouseholdKey, source.Id, scores, housing,
                review.NonHousingHardshipEvidenceReference,
                review.OriginalGeographicFactor);
            _ = NeedsBasedAllocationV11.CalculateHouseholdFactor(assessed);

            manifestRows.Add(new
            {
                review.Id, review.SnapshotId, source.HouseholdKey,
                review.ReviewerAccountId, review.ReviewedAtUtc,
                review.FormulaVersion, review.SourceFormulaVersion,
                review.SourceDatasetVersion, review.SourceInstructionReference,
                source.RuntimeProposalId, source.RuntimeProfileSequence,
                review.Health, review.NonHousingHardship, review.Age,
                review.Size, review.Care, review.Education, review.HousingTenure,
                review.HousingEvidenceReference,
                review.NonHousingHardshipEvidenceReference,
                review.OtherNeedsEvidenceReference, review.OriginalGeographicFactor
            });
        }

        // Version and cutoff are also hashed. The digest is a verification
        // tool, never a claim that a positive labeling rubric was approved.
        var canonicalJson = JsonSerializer.Serialize(new
        {
            contract = ManifestContractVersion,
            formula = NeedsBasedAllocationV11.FormulaVersion,
            cutoffUtc,
            rows = manifestRows
        });
        var digest = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(canonicalJson)))
            .ToLowerInvariant();
        return new(ManifestContractVersion, NeedsBasedAllocationV11.FormulaVersion,
            first.FormulaVersion, first.DatasetVersion,
            first.SourceInstructionReference, cutoffUtc, reviews.Length,
            digest, NotAdmittedStatus);
    }
}
