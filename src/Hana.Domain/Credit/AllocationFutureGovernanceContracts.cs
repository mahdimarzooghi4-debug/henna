namespace Hana.Domain.Credit;

/// <summary>
/// Separate, not interchangeable purposes. Neither enum member licenses
/// automatic numeric target construction from telemetry or prior allocations.
/// </summary>
public enum AllocationLearningTargetKind
{
    ReviewedNeedSeverity = 1,
    EvidenceBackedEssentialNeedsCoverage = 2
}

/// <summary>
/// Links one future reviewed target to the originating allocation and evidence.
/// This reference alone is NOT a numeric label, review approval or admission.
/// </summary>
public sealed record AllocationLearningTargetEvidence
{
    public Guid AllocationSnapshotId { get; }
    public Guid EvidenceId { get; }
    public AllocationLearningTargetKind Kind { get; }

    public AllocationLearningTargetEvidence(Guid allocationSnapshotId,
        Guid evidenceId, AllocationLearningTargetKind kind)
    {
        if (allocationSnapshotId == Guid.Empty || evidenceId == Guid.Empty ||
            !Enum.IsDefined(kind))
            throw new ArgumentException("Explicit snapshot, evidence and learning target kind are required.");
        AllocationSnapshotId = allocationSnapshotId;
        EvidenceId = evidenceId;
        Kind = kind;
    }
}

public enum HouseholdHousingTenure
{
    Owner = 1,
    Tenant = 2
}

/// <summary>
/// Evidence-backed qualitative housing input for a future seventh dimension.
/// No score (including zero) or weight is inferred from Owner/Tenant.
/// </summary>
public sealed record HouseholdHousingTenureEvidence
{
    public Guid SnapshotId { get; }
    public HouseholdHousingTenure Tenure { get; }
    public string EvidenceReference { get; }

    public HouseholdHousingTenureEvidence(Guid snapshotId,
        HouseholdHousingTenure tenure, string evidenceReference)
    {
        if (snapshotId == Guid.Empty || !Enum.IsDefined(tenure) ||
            string.IsNullOrWhiteSpace(evidenceReference) ||
            evidenceReference.Length > 240)
            throw new ArgumentException(
                "Housing tenure requires a valid snapshot, explicit status and evidence reference.");
        SnapshotId = snapshotId;
        Tenure = tenure;
        EvidenceReference = evidenceReference.Trim();
    }
}

/// <summary>
/// Research-only candidate of seven explicitly supplied nonnegative weights.
/// Does NOT change six-factor Commerce, score housing, or authorize promotion.
/// </summary>
public sealed record SevenFactorCoefficientDraft
{
    public string Version { get; }
    public decimal Health { get; }
    public decimal Hardship { get; }
    public decimal Age { get; }
    public decimal Size { get; }
    public decimal Care { get; }
    public decimal Education { get; }
    public decimal Housing { get; }

    public SevenFactorCoefficientDraft(string version, decimal health,
        decimal hardship, decimal age, decimal size, decimal care,
        decimal education, decimal housing)
    {
        if (string.IsNullOrWhiteSpace(version) || version.Length > 120)
            throw new ArgumentException("An explicit candidate version is required.");
        var weights = new[] { health, hardship, age, size, care, education, housing };
        if (weights.Any(w => w is < 0m or > 1m) || weights.Sum() != 1m)
            throw new ArgumentException(
                "Seven explicitly supplied nonnegative weights must sum to one.");
        Version = version.Trim();
        Health = health;
        Hardship = hardship;
        Age = age;
        Size = size;
        Care = care;
        Education = education;
        Housing = housing;
    }
}

/// <summary>
/// Unpromotable, research-only geography proposal with explicit values.
/// Never substitutes for an approved MPI dataset or calculates live grants.
/// </summary>
public sealed record GeographyParameterResearchDraft
{
    public string Version { get; }
    public string GeographyDatasetVersion { get; }
    public Guid TrainingRunId { get; }
    public Guid IndependentEvaluationId { get; }
    public decimal MinimumFactor { get; }
    public decimal MaximumFactor { get; }
    public decimal ProvincialCapitalAdjustment { get; }

    public GeographyParameterResearchDraft(string version,
        string geographyDatasetVersion, Guid trainingRunId,
        Guid independentEvaluationId, decimal minimumFactor,
        decimal maximumFactor, decimal provincialCapitalAdjustment)
    {
        if (string.IsNullOrWhiteSpace(version) || version.Length > 120 ||
            string.IsNullOrWhiteSpace(geographyDatasetVersion) ||
            geographyDatasetVersion.Length > 120 ||
            trainingRunId == Guid.Empty || independentEvaluationId == Guid.Empty ||
            minimumFactor <= 0m || maximumFactor <= minimumFactor ||
            provincialCapitalAdjustment <= 0m)
            throw new ArgumentException(
                "Research geography proposals require explicit versioned lineage and positive ordered parameters.");
        Version = version.Trim();
        GeographyDatasetVersion = geographyDatasetVersion.Trim();
        TrainingRunId = trainingRunId;
        IndependentEvaluationId = independentEvaluationId;
        MinimumFactor = minimumFactor;
        MaximumFactor = maximumFactor;
        ProvincialCapitalAdjustment = provincialCapitalAdjustment;
    }
}

/// <summary>
/// References both required funding controls; references alone NEVER attest
/// the bank transaction or grant authorization. Source verification remains
/// an external + authorized-finance task, outside this pure Domain contract.
/// </summary>
public sealed record FundingDualEvidenceReferences
{
    public Guid ProgramId { get; }
    public Guid FinanceManagerApprovalId { get; }
    public Guid BankReconciliationEvidenceId { get; }

    public FundingDualEvidenceReferences(Guid programId,
        Guid financeManagerApprovalId, Guid bankReconciliationEvidenceId)
    {
        if (programId == Guid.Empty || financeManagerApprovalId == Guid.Empty ||
            bankReconciliationEvidenceId == Guid.Empty ||
            financeManagerApprovalId == bankReconciliationEvidenceId)
            throw new ArgumentException(
                "Funding evidence requires separate finance approval and bank reconciliation references.");
        ProgramId = programId;
        FinanceManagerApprovalId = financeManagerApprovalId;
        BankReconciliationEvidenceId = bankReconciliationEvidenceId;
    }
}
