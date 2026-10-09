using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// New-model-first research reconciliation. Only an unambiguous v1.1
/// human-reviewed fact can be collapsed to a canonical reference. Contradictory
/// human evidence always abstains, never chooses a winner by timestamp.
/// </summary>
public enum NewModelConflictDisposition
{
    ConsistentSingle = 1,
    EquivalentNewModelReviews = 2,
    ExcludedNoNewModelReview = 3,
    AbstainedIncomplete = 4,
    AbstainedConflictingEvidence = 5,
    AbstainedInvalidLineage = 6
}

public sealed record NewModelHouseholdConflictResult(
    Guid HouseholdKey,
    NewModelConflictDisposition Disposition,
    Guid? CanonicalReviewId,
    int SevenFactorReviewCount,
    int HumanJudgmentCount);

public sealed record NewModelConflictReconciliationPreview(
    string ContractVersion,
    string NewModelFormulaVersion,
    DateTimeOffset CutoffUtc,
    IReadOnlyList<NewModelHouseholdConflictResult> Households,
    string Sha256,
    string AdmissionStatus);

/// <summary>
/// Read-only reconciliation for ALL selected households' historical source
/// snapshots and human reviews in one consistent PostgreSQL read.
/// Old six-feature snapshots cannot overrule the reviewed seven-feature v1.1
/// contract. New-model evidence must agree in fact and provenance, otherwise
/// the household is explicitly quarantined from training (null, never zero).
/// </summary>
public sealed class AllocationNewModelConflictReconciliationService(
    HanaAllocationLearningDbContext db, RoleAuthorizationService roles, IClock clock)
{
    public const string ContractVersion = "HENNA-V11-CONFLICT-RECONCILIATION-v1";
    public const string NotAdmittedStatus =
        "RECONCILED_REVIEW_ONLY_DATASET_TRAINING_NOT_AUTHORIZED";

    public async Task<NewModelConflictReconciliationPreview> PreviewAsync(
        Guid actor, IReadOnlyList<Guid> householdKeys,
        DateTimeOffset cutoffUtc, CancellationToken ct = default)
    {
        if (actor == Guid.Empty || !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException("Authorized Admin must request reconciliation.");
        ArgumentNullException.ThrowIfNull(householdKeys);
        if (householdKeys.Count is < 1 or > 500 ||
            householdKeys.Any(x => x == Guid.Empty) ||
            householdKeys.Distinct().Count() != householdKeys.Count)
            throw new ArgumentException("Explicit distinct household IDs (1..500) are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException("A non-future UTC cutoff is required.");

        var orderedKeys = householdKeys.OrderBy(x => x).ToArray();
        await using var snapshot = await db.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);
        var assessments = await db.Assessments.AsNoTracking()
            .Where(a => orderedKeys.Contains(a.HouseholdKey))
            .ToArrayAsync(ct);
        var assessmentIds = assessments.Select(a => a.Id).ToArray();
        var seven = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .Where(a => assessmentIds.Contains(a.SnapshotId))
            .ToArrayAsync(ct);
        var sevenIds = seven.Select(a => a.Id).ToArray();
        var judgments = await db.QualitativeSeverityReviews.AsNoTracking()
            .Where(a => sevenIds.Contains(a.SevenFactorReviewId))
            .ToArrayAsync(ct);

        // An empty historical input is not proof of "no unmet need".
        // Every v1.1 reviewed source must be first-party and attested, not
        // manufactured by interpreting an earlier six-factor score.
        var reviewedSourceIds = seven.Select(x => x.SnapshotId).Distinct().ToHashSet();
        var reviewedSources = assessments
            .Where(a => reviewedSourceIds.Contains(a.Id)).ToArray();
        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, reviewedSources, ct);
        var byAssessment = assessments.ToDictionary(x => x.Id);
        var bySeven = seven.GroupBy(x => x.SnapshotId)
            .ToDictionary(g => g.Key, g => g.ToArray());
        var byJudgment = judgments.GroupBy(x => x.SevenFactorReviewId)
            .ToDictionary(g => g.Key, g => g.ToArray());

        var results = new List<NewModelHouseholdConflictResult>(orderedKeys.Length);
        var manifestRows = new List<object>(orderedKeys.Length);
        foreach (var key in orderedKeys)
        {
            var householdSources = assessments.Where(a => a.HouseholdKey == key)
                .OrderBy(a => a.Id).ToArray();
            var features = householdSources.SelectMany(a =>
                bySeven.GetValueOrDefault(a.Id) ??
                    Array.Empty<AllocationReviewedSevenFactorRecord>())
                .OrderBy(f => f.Id).ToArray();
            var human = features.SelectMany(f =>
                byJudgment.GetValueOrDefault(f.Id) ??
                    Array.Empty<AllocationQualitativeSeverityReviewRecord>())
                .OrderBy(r => r.Id).ToArray();
            NewModelConflictDisposition status;
            Guid? selected = null;
            var factSignatures = new List<string>(human.Length);
            if (features.Length == 0)
                status = NewModelConflictDisposition.ExcludedNoNewModelReview;
            else if (features.Any(f => !byAssessment.TryGetValue(f.SnapshotId, out var source) ||
                !lineage.ContainsKey(f.SnapshotId) ||
                f.FormulaVersion != NeedsBasedAllocationV11.FormulaVersion ||
                f.SourceFormulaVersion != source.FormulaVersion ||
                f.SourceDatasetVersion != source.DatasetVersion ||
                f.SourceInstructionReference != source.SourceInstructionReference ||
                f.OriginalGeographicFactor != source.GeographicFactor ||
                f.ReviewedAtUtc > cutoffUtc || f.ReviewedAtUtc.Offset != TimeSpan.Zero))
                status = NewModelConflictDisposition.AbstainedInvalidLineage;
            else if (human.Length == 0 ||
                features.Any(f => !byJudgment.ContainsKey(f.Id)) ||
                human.Any(r => r.ReviewedAtUtc > cutoffUtc ||
                    r.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                    r.EvidenceObservedAtUtc.Offset != TimeSpan.Zero ||
                    r.ScaleVersion != ReviewedNeedSeverityScaleJudgment.ScaleVersion ||
                    r.CriteriaVersion != ReviewedNeedSeverityQualitativeRubricV1.Version ||
                    r.SeverityLevel is null ||
                    r.EvidenceDisposition != (int)NeedSeverityEvidenceDisposition.SufficientAndConsistent ||
                    r.HumanSelectedBasis != r.SeverityLevel))
                status = NewModelConflictDisposition.AbstainedIncomplete;
            else
            {
                var byId = features.ToDictionary(f => f.Id);
                var valid = true;
                foreach (var r in human)
                {
                    var f = byId[r.SevenFactorReviewId];
                    var source = byAssessment[f.SnapshotId];
                    if (r.SnapshotId != f.SnapshotId ||
                        r.ReviewerAccountId == Guid.Empty ||
                        r.SourceFormulaVersion != source.FormulaVersion ||
                        r.SourceDatasetVersion != source.DatasetVersion ||
                        r.SourceInstructionReference != source.SourceInstructionReference ||
                        r.EvidenceObservedAtUtc > source.AssessedAtUtc ||
                        string.IsNullOrWhiteSpace(r.EvidenceReference) ||
                        string.IsNullOrWhiteSpace(r.Rationale) ||
                        string.IsNullOrWhiteSpace(f.HousingEvidenceReference) ||
                        string.IsNullOrWhiteSpace(f.NonHousingHardshipEvidenceReference) ||
                        string.IsNullOrWhiteSpace(f.OtherNeedsEvidenceReference))
                    {
                        valid = false;
                        break;
                    }
                    try
                    {
                        var scores = new HouseholdNeedScores(f.Health, f.NonHousingHardship,
                            f.Age, f.Size, f.Care, f.Education);
                        var housing = new HouseholdHousingTenureEvidence(
                            source.Id, (HouseholdHousingTenure)f.HousingTenure,
                            f.HousingEvidenceReference);
                        _ = NeedsBasedAllocationV11.CalculateHouseholdFactor(
                            new HouseholdSevenFactorAssessmentV11(
                                key, source.Id, scores, housing,
                                f.NonHousingHardshipEvidenceReference,
                                f.OriginalGeographicFactor));
                    }
                    catch (ArgumentException)
                    {
                        valid = false;
                        break;
                    }
                    // The source ID, actual seven features, cited documentary
                    // evidence, observed time and human severity must all
                    // agree. Review ID/time or reviewer name alone is not an
                    // assessment difference; these remain in the audit digest.
                    factSignatures.Add(JsonSerializer.Serialize(new
                    {
                        f.SnapshotId, f.Health, f.NonHousingHardship, f.Age,
                        f.Size, f.Care, f.Education, f.HousingTenure,
                        f.HousingEvidenceReference,
                        f.NonHousingHardshipEvidenceReference,
                        f.OtherNeedsEvidenceReference,
                        f.OriginalGeographicFactor,
                        r.EvidenceDisposition, r.SeverityLevel,
                        r.HumanSelectedBasis, r.EvidenceReference,
                        r.EvidenceObservedAtUtc
                    }));
                }
                if (!valid)
                    status = NewModelConflictDisposition.AbstainedInvalidLineage;
                else if (factSignatures.Distinct(StringComparer.Ordinal).Count() != 1)
                    status = NewModelConflictDisposition.AbstainedConflictingEvidence;
                else
                {
                    // A canonical ID is only a reference to an IDENTICAL
                    // judgment, not an AI decision or latest-wins promotion.
                    status = human.Length == 1 && features.Length == 1
                        ? NewModelConflictDisposition.ConsistentSingle
                        : NewModelConflictDisposition.EquivalentNewModelReviews;
                    selected = human.Select(x => x.Id).Min();
                }
            }

            results.Add(new(key, status, selected, features.Length, human.Length));
            manifestRows.Add(new
            {
                household = key,
                disposition = status.ToString(),
                canonicalReview = selected,
                snapshots = householdSources.Select(x => new
                {
                    x.Id, x.FormulaVersion, x.DatasetVersion,
                    x.SourceInstructionReference, x.RuntimeProposalId,
                    x.RuntimeProfileSequence, x.AssessedAtUtc, x.RecordedAtUtc
                }).ToArray(),
                sevenReviews = features.Select(f => new
                {
                    f.Id, f.SnapshotId, f.ReviewerAccountId,
                    f.FormulaVersion, f.ReviewedAtUtc,
                    f.Health, f.NonHousingHardship, f.Age, f.Size,
                    f.Care, f.Education, f.HousingTenure,
                    f.HousingEvidenceReference, f.NonHousingHardshipEvidenceReference,
                    f.OtherNeedsEvidenceReference, f.OriginalGeographicFactor
                }).ToArray(),
                severityReviews = human.Select(h => new
                {
                    h.Id, h.SevenFactorReviewId, h.ReviewerAccountId,
                    h.ScaleVersion, h.CriteriaVersion, h.EvidenceDisposition,
                    h.SeverityLevel, h.HumanSelectedBasis, h.EvidenceReference,
                    h.EvidenceObservedAtUtc, h.Rationale, h.ReviewedAtUtc
                }).ToArray()
            });
        }
        var canonical = JsonSerializer.Serialize(new
        {
            contract = ContractVersion,
            formula = NeedsBasedAllocationV11.FormulaVersion,
            cutoffUtc,
            households = manifestRows
        });
        var digest = Convert.ToHexString(SHA256.HashData(
            Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        await snapshot.CommitAsync(ct);
        return new(ContractVersion, NeedsBasedAllocationV11.FormulaVersion,
            cutoffUtc, results.AsReadOnly(), digest, NotAdmittedStatus);
    }
}
