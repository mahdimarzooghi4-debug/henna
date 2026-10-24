using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Descriptive first-party source conflicts for explicitly chosen human reviews.
/// No outcome, score, selection, resolution or Dataset admission is inferred.
/// </summary>
public sealed record SevenFactorReviewTriageEntry(
    Guid ReviewId, string Finding, IReadOnlyList<string> Reasons,
    int HouseholdFeatureReviewCount, int HouseholdHumanReviewCount);

public sealed record SevenFactorHumanReviewTriageResult(
    string ContractVersion, string Status, DateTimeOffset CutoffUtc,
    int SelectedReviewCount, string Sha256,
    IReadOnlyList<SevenFactorReviewTriageEntry> Entries,
    bool DatasetAdmitted, bool HumanConflictResolved,
    bool ModelTrained, bool ModelApproved, bool RuntimeApplied);

public sealed class AllocationSevenFactorHumanReviewTriageService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public const string ContractVersion = "HENNA-SEVEN-FACTOR-HUMAN-REVIEW-TRIAGE-v1";
    public const string Status = "DESCRIPTIVE_TRIAGE_ONLY_NOT_ADMITTED";
    public const string NoStructuralBlocker = "NO_STRUCTURAL_BLOCKER_NOT_ADMITTED";
    public const string NeedsHumanReview = "NEEDS_EXPLICIT_HUMAN_REVIEW";

    public const string CompetingHumanReviews = "COMPETING_HUMAN_REVIEWS";
    public const string CompetingFeatureReviews = "COMPETING_FEATURE_REVIEWS";
    public const string AbstainedOrConflicting = "ABSTAINED_OR_CONFLICTING_EVIDENCE";
    public const string OutsideCutoff = "REVIEW_OR_SOURCE_AFTER_CUTOFF";
    public const string SourceLineageUnverified = "FIRST_PARTY_SOURCE_LINEAGE_UNVERIFIED";

    public async Task<SevenFactorHumanReviewTriageResult> PreviewAsync(
        Guid actor, IReadOnlyList<Guid> selectedReviewIds,
        DateTimeOffset cutoffUtc, CancellationToken ct = default)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Authorized Admin required.");
        ArgumentNullException.ThrowIfNull(selectedReviewIds);
        if (selectedReviewIds.Count is < 1 or > 500 ||
            selectedReviewIds.Any(x => x == Guid.Empty) ||
            selectedReviewIds.Distinct().Count() != selectedReviewIds.Count)
            throw new ArgumentException("Select 1–500 unique human review IDs.");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("Valid nonfuture UTC cutoff required.");

        await using var tx = await db.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);
        var ids = selectedReviewIds.OrderBy(x => x).ToArray();
        var reviews = await db.QualitativeSeverityReviews.AsNoTracking()
            .Where(x => ids.Contains(x.Id)).OrderBy(x => x.Id).ToArrayAsync(ct);
        if (reviews.Length != ids.Length)
            throw new ArgumentException("Every exact selected human review must exist.");

        var featureIds = reviews.Select(x => x.SevenFactorReviewId).Distinct().ToArray();
        var featureReviews = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .Where(x => featureIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        if (featureReviews.Count != featureIds.Length ||
            reviews.Any(x => !featureReviews.ContainsKey(x.SevenFactorReviewId) ||
                featureReviews[x.SevenFactorReviewId].SnapshotId != x.SnapshotId))
            throw new ArgumentException("Invalid seven-factor review-to-source lineage.");

        var snapshotIds = featureReviews.Values.Select(x => x.SnapshotId).Distinct().ToArray();
        var selectedSources = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        if (selectedSources.Count != snapshotIds.Length)
            throw new ArgumentException("Selected first-party source record is missing.");

        // All historical and later source snapshots of a selected household.
        // A review created after the cutoff must still be visible as competing
        // instead of implicitly preferring the earlier, cleaner snapshot.
        var households = selectedSources.Values.Select(x => x.HouseholdKey).Distinct().ToArray();
        var siblings = await db.Assessments.AsNoTracking()
            .Where(x => households.Contains(x.HouseholdKey))
            .ToArrayAsync(ct);
        var siblingIds = siblings.Select(x => x.Id).ToArray();
        var allFeatures = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .Where(x => siblingIds.Contains(x.SnapshotId))
            .ToArrayAsync(ct);
        var allHuman = await db.QualitativeSeverityReviews.AsNoTracking()
            .Where(x => siblingIds.Contains(x.SnapshotId))
            .ToArrayAsync(ct);

        var householdForSnapshot = siblings.ToDictionary(x => x.Id, x => x.HouseholdKey);
        var featureCounts = allFeatures.GroupBy(x => householdForSnapshot[x.SnapshotId])
            .ToDictionary(g => g.Key, g => g.Count());
        var humanCounts = allHuman.GroupBy(x => householdForSnapshot[x.SnapshotId])
            .ToDictionary(g => g.Key, g => g.Count());

        var trusted = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, selectedSources.Values.ToArray(), ct);
        var entries = new List<SevenFactorReviewTriageEntry>();
        foreach (var review in reviews)
        {
            var feature = featureReviews[review.SevenFactorReviewId];
            var source = selectedSources[feature.SnapshotId];
            var household = source.HouseholdKey;
            var countFeatures = featureCounts.GetValueOrDefault(household);
            var countHuman = humanCounts.GetValueOrDefault(household);
            var reasons = new List<string>();
            if (countFeatures > 1) reasons.Add(CompetingFeatureReviews);
            if (countHuman > 1) reasons.Add(CompetingHumanReviews);
            if (review.EvidenceDisposition != (int)NeedSeverityEvidenceDisposition.SufficientAndConsistent ||
                review.SeverityLevel is null or < 0 or > 4 ||
                review.HumanSelectedBasis != review.SeverityLevel ||
                review.ScaleVersion != ReviewedNeedSeverityScaleJudgment.ScaleVersion ||
                review.CriteriaVersion != ReviewedNeedSeverityQualitativeRubricV1.Version)
                reasons.Add(AbstainedOrConflicting);
            if (review.ReviewedAtUtc > cutoffUtc ||
                feature.ReviewedAtUtc > cutoffUtc ||
                source.AssessedAtUtc > cutoffUtc ||
                review.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                feature.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                review.EvidenceObservedAtUtc.Offset != TimeSpan.Zero)
                reasons.Add(OutsideCutoff);
            if (!trusted.ContainsKey(source.Id) ||
                source.HouseholdKey == Guid.Empty ||
                review.SevenFactorReviewId != feature.Id ||
                review.SourceFormulaVersion != source.FormulaVersion ||
                review.SourceDatasetVersion != source.DatasetVersion ||
                review.SourceInstructionReference != source.SourceInstructionReference ||
                feature.FormulaVersion != NeedsBasedAllocationV11.FormulaVersion ||
                feature.SourceFormulaVersion != source.FormulaVersion ||
                feature.SourceDatasetVersion != source.DatasetVersion ||
                feature.SourceInstructionReference != source.SourceInstructionReference ||
                feature.OriginalGeographicFactor != source.GeographicFactor ||
                review.EvidenceObservedAtUtc > source.AssessedAtUtc ||
                string.IsNullOrWhiteSpace(review.EvidenceReference) ||
                string.IsNullOrWhiteSpace(review.Rationale) ||
                string.IsNullOrWhiteSpace(feature.OtherNeedsEvidenceReference))
                reasons.Add(SourceLineageUnverified);
            entries.Add(new(review.Id,
                reasons.Count == 0 ? NoStructuralBlocker : NeedsHumanReview,
                reasons.ToArray(), countFeatures, countHuman));
        }

        var sha256 = ComputeFingerprint(ids, cutoffUtc, reviews, featureReviews,
            selectedSources, siblings, allFeatures, allHuman, trusted, entries);
        await tx.CommitAsync(ct);
        return new(ContractVersion, Status, cutoffUtc, entries.Count, sha256, entries,
            false, false, false, false, false);
    }

    private static string ComputeFingerprint(
        Guid[] selectedIds, DateTimeOffset cutoffUtc,
        IReadOnlyCollection<AllocationQualitativeSeverityReviewRecord> selectedReviews,
        IReadOnlyDictionary<Guid, AllocationReviewedSevenFactorRecord> selectedFeatures,
        IReadOnlyDictionary<Guid, AllocationAssessmentRecord> selectedSources,
        IReadOnlyCollection<AllocationAssessmentRecord> siblingSources,
        IReadOnlyCollection<AllocationReviewedSevenFactorRecord> siblingFeatures,
        IReadOnlyCollection<AllocationQualitativeSeverityReviewRecord> siblingHumanReviews,
        IReadOnlyDictionary<Guid, AllocationTrainingLineage> trusted,
        IReadOnlyCollection<SevenFactorReviewTriageEntry> entries)
    {
        // Canonical projections include persisted review content, source fields
        // and sibling evidence, not only displayed counts. A changed rationale
        // or source reference invalidates the old digest even if reason codes
        // happen to remain identical.
        var reviews = selectedReviews.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.SevenFactorReviewId, x.SnapshotId, x.ReviewerAccountId,
            x.ScaleVersion, x.CriteriaVersion, x.SourceFormulaVersion,
            x.SourceDatasetVersion, x.SourceInstructionReference,
            x.EvidenceDisposition, x.SeverityLevel, x.HumanSelectedBasis,
            x.EvidenceReference, x.EvidenceObservedAtUtc, x.Rationale, x.ReviewedAtUtc
        }).ToArray();
        var features = selectedFeatures.Values.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.SnapshotId, x.ReviewerAccountId, x.FormulaVersion,
            x.SourceFormulaVersion, x.SourceDatasetVersion, x.SourceInstructionReference,
            x.Health, x.NonHousingHardship, x.Age, x.Size, x.Care, x.Education,
            x.HousingTenure, x.HousingEvidenceReference,
            x.NonHousingHardshipEvidenceReference, x.OtherNeedsEvidenceReference,
            x.OriginalGeographicFactor, x.ReviewedAtUtc
        }).ToArray();
        var sources = selectedSources.Values.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.HouseholdKey, x.RecordedByAccountId, x.EvidenceReference,
            x.FormulaVersion, x.RuntimeProposalId, x.RuntimeProfileSequence,
            x.DatasetVersion, x.SourceInstructionReference, x.GeographicFactor,
            x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education,
            x.AllocatedRial, x.AssessedAtUtc, x.RecordedAtUtc
        }).ToArray();
        var allSources = siblingSources.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.HouseholdKey, x.RecordedByAccountId, x.EvidenceReference,
            x.FormulaVersion, x.RuntimeProposalId, x.RuntimeProfileSequence,
            x.DatasetVersion, x.SourceInstructionReference, x.GeographicFactor,
            x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education,
            x.AllocatedRial, x.AssessedAtUtc, x.RecordedAtUtc
        }).ToArray();
        var allFeatures = siblingFeatures.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.SnapshotId, x.ReviewerAccountId, x.FormulaVersion,
            x.SourceFormulaVersion, x.SourceDatasetVersion, x.SourceInstructionReference,
            x.Health, x.NonHousingHardship, x.Age, x.Size, x.Care, x.Education,
            x.HousingTenure, x.HousingEvidenceReference,
            x.NonHousingHardshipEvidenceReference, x.OtherNeedsEvidenceReference,
            x.OriginalGeographicFactor, x.ReviewedAtUtc
        }).ToArray();
        var allHuman = siblingHumanReviews.OrderBy(x => x.Id).Select(x => new
        {
            x.Id, x.SevenFactorReviewId, x.SnapshotId, x.ReviewerAccountId,
            x.ScaleVersion, x.CriteriaVersion, x.SourceFormulaVersion,
            x.SourceDatasetVersion, x.SourceInstructionReference,
            x.EvidenceDisposition, x.SeverityLevel, x.HumanSelectedBasis,
            x.EvidenceReference, x.EvidenceObservedAtUtc, x.Rationale, x.ReviewedAtUtc
        }).ToArray();
        var lineage = selectedSources.Values.OrderBy(x => x.Id).Select(source =>
        {
            trusted.TryGetValue(source.Id, out var resolved);
            return new
            {
                sourceId = source.Id,
                eligible = resolved is not null,
                runtimeProposalId = resolved?.RuntimeProposalId,
                runtimeProfileSequence = resolved?.RuntimeProfileSequence,
                baselineVersion = resolved?.Baseline.Version,
                baselineHealth = resolved?.Baseline.Health,
                baselineHardship = resolved?.Baseline.Hardship,
                baselineAge = resolved?.Baseline.Age,
                baselineSize = resolved?.Baseline.Size,
                baselineCare = resolved?.Baseline.Care,
                baselineEducation = resolved?.Baseline.Education
            };
        }).ToArray();
        var findings = entries.OrderBy(x => x.ReviewId).Select(x => new
        {
            x.ReviewId, x.Finding, Reasons = x.Reasons.ToArray(),
            x.HouseholdFeatureReviewCount, x.HouseholdHumanReviewCount
        }).ToArray();
        var payload = new
        {
            contractVersion = ContractVersion, cutoffUtc,
            selectedReviewIds = selectedIds.OrderBy(x => x).ToArray(),
            selectedReviews = reviews, selectedFeatures = features,
            selectedSources = sources, siblingSources = allSources,
            siblingFeatureReviews = allFeatures, siblingHumanReviews = allHuman,
            resolvedLineage = lineage, findings
        };
        return Convert.ToHexString(SHA256.HashData(
            JsonSerializer.SerializeToUtf8Bytes(payload))).ToLowerInvariant();
    }
}
