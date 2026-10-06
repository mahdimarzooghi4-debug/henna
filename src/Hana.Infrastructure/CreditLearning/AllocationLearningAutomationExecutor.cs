namespace Hana.Infrastructure.CreditLearning;

public sealed record AllocationLearningAutomationRunResult(
    Guid RequestId,
    Guid RunId,
    string Status,
    Guid? ProposalId);

public sealed record AllocationLearningAutomationExecution(
    string Status,
    int ReadyCohortCount,
    IReadOnlyList<AllocationLearningAutomationRunResult> Runs);

/// <summary>
/// Executes only cohorts approved by the explicit automation policy.
/// Training stays offline and every improving result remains a proposal
/// requiring independent human review; this service has no activation path.
/// </summary>
public sealed class AllocationLearningAutomationExecutor(
    AllocationLearningAutomationPlanner planner,
    AllocationLearningAutomationPolicy policy,
    AllocationTrainingWorkflow training)
{
    public async Task<AllocationLearningAutomationExecution> ExecuteReadyAsync(
        CancellationToken ct = default)
    {
        if (!policy.IsConfigured)
            return new(
                "POLICY_NOT_CONFIGURED",
                ReadyCohortCount: 0,
                Runs: Array.Empty<AllocationLearningAutomationRunResult>());

        var plan = await planner.BuildAsync(ct);
        var ready = plan.Cohorts
            .Where(x => x.MeetsConfiguredTrigger && x.RequestId is not null)
            .OrderBy(x => x.DatasetVersion, StringComparer.Ordinal)
            .ThenBy(x => x.SourceInstructionReference, StringComparer.Ordinal)
            .ThenBy(x => x.RubricVersion, StringComparer.Ordinal)
            .ToArray();

        if (ready.Length == 0)
            return new(
                "WAITING_FOR_CONFIGURED_TRIGGER",
                ReadyCohortCount: 0,
                Runs: Array.Empty<AllocationLearningAutomationRunResult>());

        var results = new List<AllocationLearningAutomationRunResult>();
        foreach (var cohort in ready)
        {
            ct.ThrowIfCancellationRequested();
            var requestId = cohort.RequestId!.Value;
            var run = await training.TrainAsync(
                policy.AutomationAccountId!.Value,
                cohort.LabelIds,
                policy.PoolRial!.Value,
                // Stable for an unchanged cohort. Never use a timer timestamp
                // here or the same deterministic request could describe a
                // different training fingerprint.
                cohort.LatestReviewedAtUtc,
                requestId,
                ct);
            results.Add(new(
                requestId,
                run.Id,
                run.Status,
                run.ProposalId));
        }

        return new(
            "EXECUTED",
            ReadyCohortCount: ready.Length,
            Runs: results.AsReadOnly());
    }
}
