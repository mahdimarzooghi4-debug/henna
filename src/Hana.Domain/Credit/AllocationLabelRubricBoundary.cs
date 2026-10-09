namespace Hana.Domain.Credit;

/// <summary>
/// Version identities for approved review *foundations*, not complete numeric
/// labeling rubrics. This is a known-negative guard, never a positive registry.
/// Keep it in Domain so coefficient learners and independent evaluation cannot
/// bypass the existing Infrastructure API checks.
/// </summary>
public static class AllocationLabelRubricBoundary
{
    public const string JudgmentFrameworkVersion = "HENNA-AJF-v1";
    public const string ReviewRubricFoundationVersion = "HENNA-ARR-v1";
    public const string PartialFiveLevelScaleVersion = ReviewedNeedSeverityScaleJudgment.ScaleVersion;

    public static bool IsNonLabelingFoundation(string? rubricVersion)
    {
        var version = rubricVersion?.Trim();
        return string.Equals(version, JudgmentFrameworkVersion,
                   StringComparison.OrdinalIgnoreCase) ||
               string.Equals(version, ReviewRubricFoundationVersion,
                   StringComparison.OrdinalIgnoreCase) ||
               string.Equals(version, PartialFiveLevelScaleVersion,
                   StringComparison.OrdinalIgnoreCase);
    }

    public static void RejectNonLabelingFoundation(string? rubricVersion)
    {
        if (IsNonLabelingFoundation(rubricVersion))
            throw new ArgumentException(
                "HENNA-AJF-v1, HENNA-ARR-v1 and the five-level severity scale are not approved complete numeric labeling rubrics.");
    }
}
