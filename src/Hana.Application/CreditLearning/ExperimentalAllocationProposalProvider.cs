using Hana.Application.Time;
using Hana.Domain.Credit;

namespace Hana.Application.CreditLearning;

/// <summary>Offline learner. Callers must establish authorized, independently reviewed labels.</summary>
public sealed class ExperimentalAllocationProposalProvider(IClock clock) : IAllocationProposalProvider
{
    public Task<AllocationModelProposal> ProposeAsync(AllocationResearchRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DatasetVersion);
        if (request.ReviewedExamples is null)
            throw new ArgumentException("Independently reviewed need labels are required; usage is not a label.");
        ArgumentNullException.ThrowIfNull(request.Cases);
        if (request.Cases.Any(x => x is null) ||
            request.Cases.Select(x => x.HouseholdKey).Distinct().Count() != request.Cases.Count)
            throw new ArgumentException("Distinct assessment cases are required.");
        var cases = request.Cases.ToDictionary(x => x.HouseholdKey);
        if (request.ReviewedExamples.Any(x => x is null || !cases.TryGetValue(x.HouseholdKey, out var assessment) ||
            assessment.Scores != x.Scores))
            throw new ArgumentException("Reviewed labels must reference matching assessment cases.");
        var result = ExperimentalAllocationWeightLearner.Train(request.ReviewedExamples,
            request.Baseline, clock.UtcNow, cancellationToken);
        return Task.FromResult(new AllocationModelProposal(ExperimentalAllocationWeightLearner.ModelVersion,
            result.Candidate, "Experimental supervised fit to independently reviewed need scores; " +
            "held-out error improved. Requires fairness assessment and human review before any pilot.",
            result.Metrics, request.DatasetVersion));
    }
}
