using System.Text.RegularExpressions;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>Only compares exactly rechecked source identities, never admits a dataset.</summary>
public sealed record SevenFactorManifestRevalidationResult(
    string ContractVersion, string PreflightContractVersion, DateTimeOffset CutoffUtc,
    string SourceFormulaVersion, string SourceDatasetVersion,
    string SourceInstructionReference, int TrainingCount, int ValidationCount,
    int EvaluationCount, string ExpectedSha256, string CurrentSha256,
    string Status, bool ExactManifestUnchanged, bool DatasetAdmitted,
    bool ModelTrained, bool ModelApproved, bool RuntimeApplied);

public sealed class SevenFactorManifestStaleException()
    : Exception("The selected human review partition has changed and must be inspected again.");

/// <summary>
/// Re-uses the authoritative first-party PostgreSQL REPEATABLE READ preflight.
/// Requires the exact previous digest; never silently moves to a later cutoff
/// or substitutes latest reviews, and does not write/approve anything.
/// </summary>
public sealed class AllocationSevenFactorManifestRevalidationService(
    AllocationSevenFactorPartitionPreflightService preflight)
{
    public const string ContractVersion = "HENNA-SEVEN-FACTOR-MANIFEST-REVALIDATION-v1";
    public const string Status = "UNCHANGED_HUMAN_PARTITION_STILL_NOT_ADMITTED";
    private static readonly Regex ExactDigest = new(
        "^[0-9a-f]{64}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public async Task<SevenFactorManifestRevalidationResult> RevalidateAsync(
        Guid actor, IReadOnlyList<Guid> trainingReviewIds,
        IReadOnlyList<Guid> validationReviewIds,
        IReadOnlyList<Guid> evaluationReviewIds, DateTimeOffset cutoffUtc,
        string expectedSha256, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(expectedSha256) ||
            !ExactDigest.IsMatch(expectedSha256))
            throw new ArgumentException("An exact previously previewed lowercase SHA-256 is required.");

        // Never compare an obsolete client-side preview to itself. A fresh,
        // complete authoritative check also detects competing/unselected human
        // reviews, post-cutoff corrections, provenance and runtime drift.
        var current = await preflight.PreviewAsync(
            actor, trainingReviewIds, validationReviewIds,
            evaluationReviewIds, cutoffUtc, ct);
        if (!string.Equals(current.Sha256, expectedSha256, StringComparison.Ordinal))
            throw new SevenFactorManifestStaleException();

        if (current.ContractVersion != AllocationSevenFactorPartitionPreflightService.ContractVersion ||
            current.AdmissionStatus != AllocationSevenFactorPartitionPreflightService.NotAdmittedStatus ||
            current.CutoffUtc != cutoffUtc)
            throw new SevenFactorManifestStaleException();

        return new(ContractVersion, current.ContractVersion,
            current.CutoffUtc, current.SourceFormulaVersion,
            current.SourceDatasetVersion, current.SourceInstructionReference,
            current.TrainingCount, current.ValidationCount,
            current.EvaluationCount, expectedSha256, current.Sha256,
            Status, true, false, false, false, false);
    }
}
