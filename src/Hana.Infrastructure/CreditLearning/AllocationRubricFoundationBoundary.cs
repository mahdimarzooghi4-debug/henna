namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Known approved *reasoning* foundations are not complete numeric labeling rubrics.
/// This negative check does not approve other rubric identifiers: a positive,
/// versioned rubric admission contract still requires explicit product governance.
/// </summary>
public static class AllocationRubricFoundationBoundary
{
    public const string JudgmentFrameworkVersion = "HENNA-AJF-v1";
    public const string ReviewRubricFoundationVersion = "HENNA-ARR-v1";

    public static bool IsNonLabelingFoundation(string? rubricVersion)
    {
        var version = rubricVersion?.Trim();
        return string.Equals(version, JudgmentFrameworkVersion,
                   StringComparison.OrdinalIgnoreCase) ||
               string.Equals(version, ReviewRubricFoundationVersion,
                   StringComparison.OrdinalIgnoreCase);
    }

    public static void RejectNonLabelingFoundation(string? rubricVersion)
    {
        if (IsNonLabelingFoundation(rubricVersion))
            throw new ArgumentException(
                "HENNA-AJF-v1 and HENNA-ARR-v1 are review foundations, not approved complete numeric labeling rubrics.");
    }
}
