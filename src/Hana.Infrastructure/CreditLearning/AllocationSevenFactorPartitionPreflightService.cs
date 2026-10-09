using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record SevenFactorPartitionPreflightResult(
    string ContractVersion, DateTimeOffset CutoffUtc,
    string SourceFormulaVersion, string SourceDatasetVersion,
    string SourceInstructionReference, int TrainingCount,
    int ValidationCount, int EvaluationCount, string Sha256,
    string AdmissionStatus);

/// <summary>
/// Real first-party feature+human-judgment provenance and disjoint cohort
/// preflight. No approved numeric rubric registry yet exists; this service
/// deliberately cannot emit labels, datasets, TrainingRuns or artifacts.
/// </summary>
public sealed class AllocationSevenFactorPartitionPreflightService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public const string ContractVersion = "HENNA-SEVEN-FACTOR-HUMAN-PARTITION-PREFLIGHT-v1";
    public const string NotAdmittedStatus = "NOT_ADMITTED_COMPLETE_RUBRIC_AND_EVALUATION_GOVERNANCE_REQUIRED";

    /// <summary>
    /// Explicit human review IDs in three distinct partitions. No random
    /// assignment, sample minimum, fairness threshold or label imputation.
    /// </summary>
    public async Task<SevenFactorPartitionPreflightResult> PreviewAsync(
        Guid actor, IReadOnlyList<Guid> trainingIds,
        IReadOnlyList<Guid> validationIds, IReadOnlyList<Guid> evaluationIds,
        DateTimeOffset cutoffUtc, CancellationToken ct = default)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Explicit authorized human reviewer required.");
        ArgumentNullException.ThrowIfNull(trainingIds);
        ArgumentNullException.ThrowIfNull(validationIds);
        ArgumentNullException.ThrowIfNull(evaluationIds);
        var splits = new[] { trainingIds, validationIds, evaluationIds };
        var ids = splits.SelectMany(x => x).ToArray();
        // The nonempty partition rule is structural, not a sufficiency claim.
        if (splits.Any(x => x.Count == 0) || ids.Length > 500 ||
            ids.Any(x => x == Guid.Empty) ||
            ids.Distinct().Count() != ids.Length)
            throw new ArgumentException("Select distinct, nonempty review ID partitions (maximum 500 total).");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("A non-future UTC cutoff is required.");

        var reviews = await db.QualitativeSeverityReviews.AsNoTracking()
            .Where(r => ids.Contains(r.Id)).ToArrayAsync(ct);
        if (reviews.Length != ids.Length ||
            reviews.Any(r =>
                r.ReviewedAtUtc > cutoffUtc ||
                r.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                r.EvidenceObservedAtUtc.Offset != TimeSpan.Zero ||
                r.ScaleVersion != ReviewedNeedSeverityScaleJudgment.ScaleVersion ||
                r.CriteriaVersion != ReviewedNeedSeverityQualitativeRubricV1.Version ||
                r.EvidenceDisposition != (int)NeedSeverityEvidenceDisposition.SufficientAndConsistent ||
                r.SeverityLevel is null or < 0 or > 4 ||
                r.HumanSelectedBasis != r.SeverityLevel ||
                r.ReviewerAccountId == Guid.Empty ||
                string.IsNullOrWhiteSpace(r.EvidenceReference) ||
                string.IsNullOrWhiteSpace(r.Rationale)))
            throw new ArgumentException("Only complete, explicitly selected human judgments before the cutoff may be inspected.");

        var reviewIds = reviews.Select(r => r.SevenFactorReviewId).ToArray();
        if (reviewIds.Distinct().Count() != reviews.Length)
            throw new ArgumentException("Competing human judgments require explicit resolution, never latest-wins.");
        var features = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .Where(x => reviewIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (features.Count != reviews.Length)
            throw new ArgumentException("Every human judgment must link to a seven-factor human review.");
        var snapshotIds = features.Values.Select(x => x.SnapshotId).ToArray();
        if (snapshotIds.Distinct().Count() != snapshotIds.Length)
            throw new ArgumentException("Multiple reviewed versions of one snapshot are not one observation.");
        var sources = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (sources.Count != reviews.Length ||
            sources.Values.Select(x => x.HouseholdKey).Distinct().Count() != reviews.Length)
            throw new ArgumentException("Training, validation and evaluation households must be disjoint.");

        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, sources.Values.ToArray(), ct);
        if (lineage.Count != reviews.Length)
            throw new ArgumentException("Every source must pass real Henna first-party lineage checks.");
        var first = sources[features[reviews[0].SevenFactorReviewId].SnapshotId];
        var baseline = lineage[first.Id];

        // Explicit partitions, canonical record order, source identities and
        // the human evidence itself are part of the immutable representation.
        var selection = new Dictionary<Guid, int>();
        for (var partition = 0; partition < splits.Length; partition++)
            foreach (var id in splits[partition]) selection.Add(id, partition);

        var rows = new List<object>(reviews.Length);
        foreach (var review in reviews.OrderBy(r => selection[r.Id]).ThenBy(r => r.Id))
        {
            var feature = features[review.SevenFactorReviewId];
            var source = sources[feature.SnapshotId];
            var sourceLineage = lineage[source.Id];
            if (source.AssessedAtUtc > cutoffUtc ||
                feature.ReviewedAtUtc > cutoffUtc ||
                feature.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                review.EvidenceObservedAtUtc > source.AssessedAtUtc ||
                review.SevenFactorReviewId != feature.Id ||
                review.SnapshotId != feature.SnapshotId ||
                review.SourceFormulaVersion != source.FormulaVersion ||
                review.SourceDatasetVersion != source.DatasetVersion ||
                review.SourceInstructionReference != source.SourceInstructionReference ||
                feature.FormulaVersion != NeedsBasedAllocationV11.FormulaVersion ||
                feature.SourceFormulaVersion != source.FormulaVersion ||
                feature.SourceDatasetVersion != source.DatasetVersion ||
                feature.SourceInstructionReference != source.SourceInstructionReference ||
                feature.OriginalGeographicFactor != source.GeographicFactor ||
                source.FormulaVersion != first.FormulaVersion ||
                source.DatasetVersion != first.DatasetVersion ||
                source.SourceInstructionReference != first.SourceInstructionReference ||
                sourceLineage.RuntimeProposalId != baseline.RuntimeProposalId ||
                sourceLineage.RuntimeProfileSequence != baseline.RuntimeProfileSequence ||
                sourceLineage.Baseline != baseline.Baseline)
                throw new ArgumentException("Mixed, invalid, stale or post-allocation reviewed evidence lineage.");

            var scores = new HouseholdNeedScores(feature.Health,
                feature.NonHousingHardship, feature.Age, feature.Size,
                feature.Care, feature.Education);
            var tenure = new HouseholdHousingTenureEvidence(
                source.Id, (HouseholdHousingTenure)feature.HousingTenure,
                feature.HousingEvidenceReference);
            var reviewedAssessment = new HouseholdSevenFactorAssessmentV11(
                source.HouseholdKey, source.Id, scores, tenure,
                feature.NonHousingHardshipEvidenceReference, feature.OriginalGeographicFactor);
            _ = NeedsBasedAllocationV11.CalculateHouseholdFactor(reviewedAssessment);
            if (string.IsNullOrWhiteSpace(feature.OtherNeedsEvidenceReference))
                throw new ArgumentException("Seven-factor review has no human evidence provenance.");

            // Evidence is stored and hashed, not silently accepted as a
            // verified label or returned as a sensitive feature payload.
            rows.Add(new
            {
                partition = selection[review.Id],
                review.Id, review.SevenFactorReviewId, review.SnapshotId,
                source.HouseholdKey, review.ReviewerAccountId,
                review.EvidenceDisposition, review.SeverityLevel,
                review.HumanSelectedBasis, review.ScaleVersion, review.CriteriaVersion,
                review.EvidenceReference, review.EvidenceObservedAtUtc,
                review.Rationale, review.ReviewedAtUtc,
                featureReviewerAccountId = feature.ReviewerAccountId,
                feature.Health, feature.NonHousingHardship, feature.Age,
                feature.Size, feature.Care, feature.Education, feature.HousingTenure,
                feature.HousingEvidenceReference,
                feature.NonHousingHardshipEvidenceReference,
                feature.OtherNeedsEvidenceReference,
                feature.OriginalGeographicFactor,
                featureFormulaVersion = feature.FormulaVersion,
                featureReviewedAtUtc = feature.ReviewedAtUtc,
                source.FormulaVersion, source.DatasetVersion,
                source.SourceInstructionReference, source.RuntimeProposalId,
                source.RuntimeProfileSequence
            });
        }
        var canonical = JsonSerializer.Serialize(new
        {
            contract = ContractVersion,
            cutoffUtc,
            rows
        });
        var digest = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        return new(ContractVersion, cutoffUtc, first.FormulaVersion,
            first.DatasetVersion, first.SourceInstructionReference,
            trainingIds.Count, validationIds.Count, evaluationIds.Count,
            digest, NotAdmittedStatus);
    }
}
