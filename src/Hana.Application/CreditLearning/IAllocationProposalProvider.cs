using Hana.Domain.Credit;

namespace Hana.Application.CreditLearning;

/// <summary>Contract for a future statistical/model provider; no live activation permission.</summary>
public interface IAllocationProposalProvider
{
    Task<AllocationModelProposal> ProposeAsync(AllocationResearchRequest request,
        CancellationToken cancellationToken);
}

public sealed record AllocationResearchRequest(string DatasetVersion,
    AllocationWeightProfile Baseline, IReadOnlyList<AllocationLearningCase> Cases,
    IReadOnlyList<ReviewedNeedExample>? ReviewedExamples = null);

/// <summary>Untrusted draft requiring validation, offline evaluation and human review.</summary>
public sealed record AllocationModelProposal(string ModelVersion,
    AllocationWeightProfile Candidate, string Rationale,
    AllocationLearningMetrics? LearningMetrics = null, string? DatasetVersion = null);
