using Hana.Domain.Credit;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Compatibility facade for the Domain-level known-negative rubric boundary.
/// Neither this facade nor its absence of rejection positively approves any
/// other rubric identifier for model training or Production.
/// </summary>
public static class AllocationRubricFoundationBoundary
{
    public const string JudgmentFrameworkVersion =
        AllocationLabelRubricBoundary.JudgmentFrameworkVersion;
    public const string ReviewRubricFoundationVersion =
        AllocationLabelRubricBoundary.ReviewRubricFoundationVersion;

    public static bool IsNonLabelingFoundation(string? rubricVersion) =>
        AllocationLabelRubricBoundary.IsNonLabelingFoundation(rubricVersion);

    public static void RejectNonLabelingFoundation(string? rubricVersion) =>
        AllocationLabelRubricBoundary.RejectNonLabelingFoundation(rubricVersion);
}
