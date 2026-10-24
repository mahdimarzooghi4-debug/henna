using System.Text.RegularExpressions;

namespace Hana.Infrastructure.CreditLearning;

public sealed record SevenFactorHumanReviewTriageRevalidationResult(
    string ContractVersion, string Status, DateTimeOffset CutoffUtc,
    int SelectedReviewCount, string ExpectedSha256, string CurrentSha256,
    bool ExactTriageUnchanged, bool DatasetAdmitted, bool HumanConflictResolved,
    bool ModelTrained, bool ModelApproved, bool RuntimeApplied);

public sealed class SevenFactorHumanReviewTriageStaleException()
    : Exception("The selected human review triage source content has changed.");

/// <summary>
/// Recomputes the exact selected review and all household-sibling source
/// content from PostgreSQL. A match only confirms the descriptive report;
/// it never resolves human disagreement, admits data, trains or activates.
/// </summary>
public sealed class AllocationSevenFactorHumanReviewTriageRevalidationService(
    AllocationSevenFactorHumanReviewTriageService triage)
{
    public const string ContractVersion = "HENNA-SEVEN-FACTOR-HUMAN-REVIEW-TRIAGE-REVALIDATION-v1";
    public const string Status = "UNCHANGED_CURRENT_TRIAGE_STILL_NOT_ADMITTED";
    private static readonly Regex ExactDigest = new(
        "^[0-9a-f]{64}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public async Task<SevenFactorHumanReviewTriageRevalidationResult> RevalidateAsync(
        Guid actor, IReadOnlyList<Guid> selectedReviewIds,
        DateTimeOffset cutoffUtc, string expectedSha256, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(expectedSha256) || !ExactDigest.IsMatch(expectedSha256))
            throw new ArgumentException("An exact previously previewed lowercase SHA-256 is required.");
        var current = await triage.PreviewAsync(actor, selectedReviewIds, cutoffUtc, ct);
        if (!string.Equals(current.Sha256, expectedSha256, StringComparison.Ordinal) ||
            current.ContractVersion != AllocationSevenFactorHumanReviewTriageService.ContractVersion ||
            current.Status != AllocationSevenFactorHumanReviewTriageService.Status ||
            current.CutoffUtc != cutoffUtc)
            throw new SevenFactorHumanReviewTriageStaleException();
        return new(ContractVersion, Status, cutoffUtc, current.SelectedReviewCount,
            expectedSha256, current.Sha256, true, false, false, false, false, false);
    }
}
