using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Non-admitting, transient model-version intake readiness evidence.
/// The digest identifies checked technical lineage, NOT future registry approval.
/// </summary>
public sealed record ResearchRegistryIntakeRequirement(string Code, string Verification);

public sealed record ResearchRegistryIntakeReadiness(
    string ContractVersion, string ManifestSha256,
    string SourceTechnicalPreflightContractVersion,
    string Family, Guid ArtifactId, Guid TrainingRunId, Guid EvaluationId,
    string ArtifactSha256, string EvaluationFingerprint, string DatasetVersion,
    string ModelVersion, string ArtifactFormat, string EvaluationProtocolVersion,
    string? ExistingExecutionFoundationVersion,
    string Status, IReadOnlyList<ResearchRegistryIntakeRequirement> Requirements,
    bool RegistryRecordCreated, bool RegistrationAllowed, bool DatasetAdmitted,
    bool Approved, bool CandidateCreated, bool ProductionCompatible,
    bool RuntimeApplied);

/// <summary>
/// Builds an audit-friendly technical selection manifest from a freshly
/// re-evaluated, explicit artifact/Evaluation pair. Never writes to the DB.
/// </summary>
public sealed class AllocationModelRegistryIntakeReadinessService(
    AllocationModelVersionTechnicalPreflightService preflight)
{
    public const string ContractVersion = "HENNA-REGISTRY-INTAKE-READINESS-v1";
    public const string Status = "TECHNICAL_LINEAGE_ONLY_NOT_ADMITTED";
    public const string Unverified = "NOT_ATTESTED_BY_THIS_REPORT";

    private static readonly string[] RequirementCodes =
    [
        "APPROVED_COMPLETE_NUMERIC_REVIEW_RUBRIC",
        "DATASET_ADMISSION_AND_SOURCE_RIGHTS",
        "INDEPENDENT_EVALUATION_CONTENT_REATTESTATION",
        "TEMPORAL_FAIRNESS_AND_MISSINGNESS_CRITERIA",
        "ACCOUNTABLE_HUMAN_MODEL_REGISTRY_DECISION",
        "PILOT_AND_PRODUCTION_AUTHORIZATION",
        "EXPLICIT_RUNTIME_PROMOTION"
    ];

    public async Task<ResearchRegistryIntakeReadiness> PreviewAsync(
        string family, Guid artifactId, Guid evaluationId,
        CancellationToken ct = default)
    {
        var technical = await preflight.PreviewAsync(
            family, artifactId, evaluationId, ct);
        return Inspect(technical);
    }

    public static ResearchRegistryIntakeReadiness Inspect(
        ModelVersionTechnicalPreflightResult technical)
    {
        ArgumentNullException.ThrowIfNull(technical);
        if (technical.ContractVersion !=
                AllocationModelVersionTechnicalPreflightService.ContractVersion ||
            !technical.ArtifactHashVerified || !technical.EvaluationRecordLinked ||
            technical.ProductionRuntimeCompatible || technical.RegistrationEnabled ||
            technical.DatasetAdmitted || technical.ModelApproved ||
            technical.CandidateCreated || technical.RuntimeApplied ||
            technical.ArtifactId == Guid.Empty || technical.TrainingRunId == Guid.Empty ||
            technical.EvaluationId == Guid.Empty ||
            !Sha(technical.ArtifactSha256) || !Sha(technical.EvaluationFingerprint) ||
            string.IsNullOrWhiteSpace(technical.DatasetVersion) ||
            string.IsNullOrWhiteSpace(technical.SourceInstructionReference) ||
            string.IsNullOrWhiteSpace(technical.ModelVersion) ||
            string.IsNullOrWhiteSpace(technical.ArtifactFormat))
            throw new ArgumentException("Unapproved exact technical lineage required.");

        if (technical.Family == "XGBOOST")
        {
            if (technical.ArtifactId != technical.TrainingRunId ||
                technical.ModelVersion != HennaXGBoostOfflineLearner.ModelVersion ||
                technical.ArtifactFormat != HennaXGBoostOfflineLearner.ArtifactFormat ||
                technical.EvaluationProtocolVersion != HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion ||
                technical.ExistingExecutionFoundationVersion != HennaXGBoostRuntimeContract.RuntimeContractVersion ||
                technical.TechnicalStatus != AllocationModelVersionTechnicalPreflightService.XgboostStatus)
                throw new ArgumentException("XGBoost contract/version drift.");
        }
        else if (technical.Family == "EBM")
        {
            if (technical.ModelVersion != HennaEbmPortableArtifactVerifier.ModelVersion ||
                technical.ArtifactFormat != HennaEbmPortableArtifactVerifier.ArtifactFormat ||
                technical.EvaluationProtocolVersion != HennaEbmBenchmarkEvaluator.ProtocolVersion ||
                technical.ExistingExecutionFoundationVersion is not null ||
                technical.TechnicalStatus != AllocationModelVersionTechnicalPreflightService.EbmStatus)
                throw new ArgumentException("EBM research contract/version drift.");
        }
        else
        {
            throw new ArgumentException("Unknown model family.");
        }

        // Canonical JSON of fixed ordered fields: changing any frozen
        // selection identity or protocol changes the digest. No secrets or PII.
        var payload = JsonSerializer.Serialize(new
        {
            contractVersion = ContractVersion,
            technicalContract = technical.ContractVersion,
            technical.Family,
            artifactId = technical.ArtifactId.ToString("D"),
            trainingRunId = technical.TrainingRunId.ToString("D"),
            evaluationId = technical.EvaluationId.ToString("D"),
            technical.ModelVersion,
            technical.ArtifactFormat,
            technical.ArtifactSha256,
            technical.EvaluationFingerprint,
            technical.DatasetVersion,
            technical.SourceInstructionReference,
            technical.EvaluationProtocolVersion,
            technical.ExistingExecutionFoundationVersion,
            technical.TechnicalStatus
        });
        var digest = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        var gates = RequirementCodes.Select(code =>
            new ResearchRegistryIntakeRequirement(code, Unverified)).ToArray();
        return new(
            ContractVersion, digest, technical.ContractVersion,
            technical.Family, technical.ArtifactId, technical.TrainingRunId,
            technical.EvaluationId, technical.ArtifactSha256,
            technical.EvaluationFingerprint, technical.DatasetVersion,
            technical.ModelVersion, technical.ArtifactFormat,
            technical.EvaluationProtocolVersion,
            technical.ExistingExecutionFoundationVersion,
            Status, gates,
            false, false, false, false, false, false, false);
    }

    private static bool Sha(string? s) => s is { Length: 64 } &&
        s.All(x => x is >= '0' and <= '9' or >= 'a' and <= 'f');
}
