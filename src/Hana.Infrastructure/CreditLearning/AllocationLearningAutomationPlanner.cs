using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record AllocationLearningAutomationCohort(
    string DatasetVersion,
    string SourceInstructionReference,
    string RubricVersion,
    int TrainingLabelCount,
    int ValidationLabelCount,
    int DistinctTrainingHouseholds,
    int DistinctValidationHouseholds,
    bool HouseholdPartitionOverlap,
    DateTimeOffset LatestReviewedAtUtc,
    IReadOnlyList<Guid> LabelIds);

public sealed record AllocationLearningAutomationPlan(
    string Status,
    bool TriggerPolicyConfigured,
    bool AutomaticTrainingEnabled,
    IReadOnlyList<AllocationLearningAutomationCohort> Cohorts);

/// <summary>
/// Discovers coherent first-party reviewed-label cohorts for future automated
/// training orchestration. It deliberately does not decide when to train:
/// trigger thresholds/policy require an explicit product decision.
/// </summary>
public sealed class AllocationLearningAutomationPlanner(
    HanaAllocationLearningDbContext db)
{
    public async Task<AllocationLearningAutomationPlan> BuildAsync(
        CancellationToken ct = default)
    {
        var rows = await (
            from label in db.NeedLabels.AsNoTracking()
            join snapshot in db.Assessments.AsNoTracking()
                on label.SnapshotId equals snapshot.Id
            where snapshot.RecordedByAccountId == null &&
                  snapshot.EvidenceReference == null &&
                  snapshot.FormulaVersion ==
                    AllocationWeightProfile.Baseline.Version &&
                  snapshot.DatasetVersion ==
                    HennaAllocationLearningCapture.DatasetVersion &&
                  snapshot.SourceInstructionReference.StartsWith(
                    "henna-program:")
            select new { label, snapshot })
            .ToListAsync(ct);

        var eligible = rows
            .Where(x => AllocationTrainingWorkflow
                .IsTrainingEligibleFirstPartySnapshot(x.snapshot))
            .ToArray();

        var cohorts = eligible
            .GroupBy(x => new
            {
                x.snapshot.DatasetVersion,
                x.snapshot.SourceInstructionReference,
                x.label.RubricVersion
            })
            .Select(group =>
            {
                var trainingHouseholds = group
                    .Where(x => x.label.Partition ==
                        (int)LearningPartition.Training)
                    .Select(x => x.snapshot.HouseholdKey)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToArray();
                var validationHouseholds = group
                    .Where(x => x.label.Partition ==
                        (int)LearningPartition.Validation)
                    .Select(x => x.snapshot.HouseholdKey)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToArray();

                return new AllocationLearningAutomationCohort(
                    group.Key.DatasetVersion,
                    group.Key.SourceInstructionReference,
                    group.Key.RubricVersion,
                    group.Count(x => x.label.Partition ==
                        (int)LearningPartition.Training),
                    group.Count(x => x.label.Partition ==
                        (int)LearningPartition.Validation),
                    trainingHouseholds.Length,
                    validationHouseholds.Length,
                    trainingHouseholds.Intersect(validationHouseholds).Any(),
                    group.Max(x => x.label.ReviewedAtUtc),
                    group.Select(x => x.label.Id)
                        .Distinct()
                        .OrderBy(x => x)
                        .ToArray());
            })
            .OrderBy(x => x.DatasetVersion, StringComparer.Ordinal)
            .ThenBy(x => x.SourceInstructionReference, StringComparer.Ordinal)
            .ThenBy(x => x.RubricVersion, StringComparer.Ordinal)
            .ToArray();

        return new AllocationLearningAutomationPlan(
            cohorts.Length == 0
                ? "WAITING_FOR_REVIEWED_FIRST_PARTY_DATA"
                : "TRIGGER_POLICY_REQUIRED",
            TriggerPolicyConfigured: false,
            AutomaticTrainingEnabled: false,
            Cohorts: cohorts);
    }
}
