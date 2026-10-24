namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Inspection result, not an allowed registration, candidate or model promotion.
/// The XGBoost runtime foundation handles only raw prediction, not Commerce.
/// </summary>
public sealed record ModelVersionTechnicalPreflightResult(
    string ContractVersion, string Family, Guid ArtifactId, Guid TrainingRunId,
    Guid EvaluationId, string EvaluationFingerprint, string ModelVersion,
    string ArtifactFormat, string ArtifactSha256, string DatasetVersion,
    string SourceInstructionReference, string EvaluationProtocolVersion,
    string? ExistingExecutionFoundationVersion, string TechnicalStatus,
    bool ArtifactAndEvaluationAttested, bool ProductionRuntimeCompatible,
    bool RegistrationEnabled, bool DatasetAdmitted, bool ModelApproved,
    bool CandidateCreated, bool RuntimeApplied);

/// <summary>
/// Strict inspection of explicit human-selected artifact + independent
/// evaluation from a DB-consistent, fully validated existing dossier.
/// Does NOT enable a generic model provider, registration or inference.
/// </summary>
public sealed class AllocationModelVersionTechnicalPreflightService(
    AllocationModelArtifactDossierService dossiers)
{
    public const string ContractVersion = "HENNA-MODEL-VERSION-TECHNICAL-PREFLIGHT-v1";
    public const string XgboostStatus = "EXISTING_IN_PROCESS_RAW_PREDICTION_FOUNDATION_ONLY";
    public const string EbmStatus = "OFFLINE_CHALLENGER_NO_PRODUCTION_EXECUTION_CONTRACT";

    public async Task<ModelVersionTechnicalPreflightResult> PreviewAsync(
        string family, Guid artifactId, Guid evaluationId, CancellationToken ct = default)
    {
        if (evaluationId == Guid.Empty)
            throw new ArgumentException("Explicit independent Evaluation ID is required.");
        var dossier = await dossiers.ReadAsync(family, artifactId, ct)
            ?? throw new ArgumentException("Selected research artifact does not exist.");
        return Inspect(dossier, evaluationId);
    }

    public static ModelVersionTechnicalPreflightResult Inspect(
        ResearchModelArtifactDossier dossier, Guid evaluationId)
    {
        ArgumentNullException.ThrowIfNull(dossier);
        if (evaluationId == Guid.Empty ||
            dossier.ContractVersion != AllocationModelArtifactDossierService.ContractVersion ||
            dossier.EvidenceStatus != AllocationModelArtifactDossierService.EvidenceStatus ||
            !dossier.ArtifactVerified ||
            dossier.Registered || dossier.Approved || dossier.Active || dossier.RuntimeApplied ||
            dossier.ArtifactId == Guid.Empty || dossier.TrainingRunId == Guid.Empty ||
            !IsSha(dossier.ArtifactSha256) ||
            dossier.Evaluations is null)
            throw new ArgumentException("An exact unapproved, attested research dossier is required.");

        // No automatic winner or automatic Evaluation selection. An omitted
        // or stale/mismatched evaluation ID cannot be replaced with latest.
        var selected = dossier.Evaluations.Where(x => x.Id == evaluationId).ToArray();
        if (selected.Length != 1)
            throw new ArgumentException("The explicitly selected Evaluation does not belong to this artifact.");
        var evidence = selected[0];
        if (!IsSha(evidence.EvaluationFingerprint) ||
            evidence.DatasetVersion != dossier.DatasetVersion ||
            string.IsNullOrWhiteSpace(evidence.SourceInstructionReference) ||
            evidence.CutoffUtc.Offset != TimeSpan.Zero ||
            evidence.RecordedAtUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("Evaluation lineage is incomplete.");

        string? executionFoundation;
        string status;
        if (dossier.Family == "XGBOOST" &&
            dossier.ModelVersion == HennaXGBoostOfflineLearner.ModelVersion &&
            dossier.ArtifactFormat == HennaXGBoostOfflineLearner.ArtifactFormat &&
            dossier.ArtifactId == dossier.TrainingRunId &&
            evidence.ProtocolVersion == HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion)
        {
            executionFoundation = HennaXGBoostRuntimeContract.RuntimeContractVersion;
            status = XgboostStatus;
        }
        else if (dossier.Family == "EBM" &&
            dossier.ModelVersion == HennaEbmPortableArtifactVerifier.ModelVersion &&
            dossier.ArtifactFormat == HennaEbmPortableArtifactVerifier.ArtifactFormat &&
            evidence.ProtocolVersion == HennaEbmBenchmarkEvaluator.ProtocolVersion)
        {
            executionFoundation = null;
            status = EbmStatus;
        }
        else
        {
            throw new ArgumentException("No exact existing execution/research contract matches the selected versions.");
        }

        // Technical identity validation is not acceptance of fairness,
        // temporal stability, dataset, eligibility, model or Production.
        return new(
            ContractVersion, dossier.Family, dossier.ArtifactId, dossier.TrainingRunId,
            evaluationId, evidence.EvaluationFingerprint, dossier.ModelVersion,
            dossier.ArtifactFormat, dossier.ArtifactSha256, dossier.DatasetVersion,
            evidence.SourceInstructionReference, evidence.ProtocolVersion,
            executionFoundation, status,
            true, false, false, false, false, false, false);
    }

    private static bool IsSha(string? value) =>
        value is { Length: 64 } &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
}
