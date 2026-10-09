using System.Security.Cryptography;
using Hana.Application.Time;
using Hana.Infrastructure.Identity;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Exact-selection, independently rechecked evidence digests.
/// Neither verdict is a reviewed need label, dataset admission or model
/// approval. The two streams are deliberately never joined or averaged.
/// </summary>
public sealed record AllocationEvidenceReattestationResult(
    string ManifestContractVersion,
    string SourceKind,
    DateTimeOffset CutoffUtc,
    int SelectedRecordCount,
    bool Matches,
    string AdmissionStatus);

public sealed class AllocationIndependentEvidenceReattestationService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public const string SevenFactorSource = "SEVEN_FACTOR_REVIEWED_FEATURES";
    public const string CoverageSource = "ESSENTIAL_NEEDS_COVERAGE_REVIEWED_OUTCOMES";

    public async Task<AllocationEvidenceReattestationResult> ReattestSevenFactorAsync(
        Guid actor, IReadOnlyList<Guid> selectedReviewIds,
        DateTimeOffset cutoffUtc, string expectedManifestContractVersion,
        string expectedSha256, CancellationToken ct = default)
    {
        RequireExactContract(expectedManifestContractVersion,
            AllocationSevenFactorReviewInventoryService.ManifestContractVersion);
        var expected = ParseSha256(expectedSha256);
        var preview = await new AllocationSevenFactorReviewInventoryService(
            db, roles, clock).PreviewAsync(actor, selectedReviewIds, cutoffUtc, ct);
        return new(preview.ManifestContractVersion, SevenFactorSource,
            preview.CutoffUtc, preview.ReviewedHouseholdCount,
            CryptographicOperations.FixedTimeEquals(
                expected, Convert.FromHexString(preview.Sha256)),
            preview.AdmissionStatus);
    }

    public async Task<AllocationEvidenceReattestationResult> ReattestCoverageAsync(
        Guid actor, IReadOnlyList<Guid> selectedOutcomeEventIds,
        DateTimeOffset cutoffUtc, string expectedManifestContractVersion,
        string expectedSha256, CancellationToken ct = default)
    {
        RequireExactContract(expectedManifestContractVersion,
            AllocationEssentialNeedsCoverageInventoryService.ManifestContractVersion);
        var expected = ParseSha256(expectedSha256);
        var preview = await new AllocationEssentialNeedsCoverageInventoryService(
            db, roles, clock).PreviewAsync(actor, selectedOutcomeEventIds, cutoffUtc, ct);
        return new(preview.ManifestContractVersion, CoverageSource,
            preview.CutoffUtc, preview.ReviewedCoverageObservationCount,
            CryptographicOperations.FixedTimeEquals(
                expected, Convert.FromHexString(preview.Sha256)),
            preview.AdmissionStatus);
    }

    private static void RequireExactContract(string? supplied, string expected)
    {
        if (!string.Equals(supplied, expected, StringComparison.Ordinal))
            throw new ArgumentException(
                "Evidence manifest contract and source kind must match exactly.");
    }

    private static byte[] ParseSha256(string? hex)
    {
        if (hex is null || hex.Length != 64 ||
            !hex.All(Uri.IsHexDigit))
            throw new ArgumentException(
                "Expected evidence digest must be exactly a SHA-256 hexadecimal value.");
        return Convert.FromHexString(hex);
    }
}
