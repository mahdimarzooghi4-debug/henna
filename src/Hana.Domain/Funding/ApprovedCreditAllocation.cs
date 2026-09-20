using Hana.Domain.Money;

namespace Hana.Domain.Funding;

/// <summary>
/// Immutable, approved restricted-credit allocation SNAPSHOT.
///
/// This type does not perform eligibility checks, verify deposited funding,
/// authorize money movement, or create ledger entries. Its inputs must originate
/// from a separately authorized, auditable approval process.
/// A beneficiary's registration alone must never create this snapshot.
/// </summary>
public sealed record ApprovedCreditAllocation
{
    public Guid AllocationId { get; }
    public string FundingSourceReference { get; }
    public Guid ProgramId { get; }
    public Guid? OrganizationId { get; }
    public Guid BeneficiaryAccountId { get; }
    public RialAmount AllocatedAmount { get; }
    public string EligibilityVersion { get; }
    public DateTimeOffset EffectiveAtUtc { get; }
    public DateTimeOffset? ExpiresAtUtc { get; }
    public string ApprovalAuditReference { get; }

    private ApprovedCreditAllocation(
        Guid allocationId,
        string fundingSourceReference,
        Guid programId,
        Guid? organizationId,
        Guid beneficiaryAccountId,
        RialAmount allocatedAmount,
        string eligibilityVersion,
        DateTimeOffset effectiveAtUtc,
        DateTimeOffset? expiresAtUtc,
        string approvalAuditReference)
    {
        AllocationId = allocationId;
        FundingSourceReference = fundingSourceReference;
        ProgramId = programId;
        OrganizationId = organizationId;
        BeneficiaryAccountId = beneficiaryAccountId;
        AllocatedAmount = allocatedAmount;
        EligibilityVersion = eligibilityVersion;
        EffectiveAtUtc = effectiveAtUtc;
        ExpiresAtUtc = expiresAtUtc;
        ApprovalAuditReference = approvalAuditReference;
    }

    public static ApprovedCreditAllocation FromApprovedDecision(
        Guid allocationId,
        string fundingSourceReference,
        Guid programId,
        Guid? organizationId,
        Guid beneficiaryAccountId,
        RialAmount allocatedAmount,
        string eligibilityVersion,
        DateTimeOffset effectiveAt,
        DateTimeOffset? expiresAt,
        string approvalAuditReference)
    {
        if (allocationId == Guid.Empty)
            throw new ArgumentException("Allocation ID is required.", nameof(allocationId));
        if (programId == Guid.Empty)
            throw new ArgumentException("Program ID is required.", nameof(programId));
        if (organizationId is Guid org && org == Guid.Empty)
            throw new ArgumentException("Organization ID must be absent or non-empty.", nameof(organizationId));
        if (beneficiaryAccountId == Guid.Empty)
            throw new ArgumentException("Beneficiary account ID is required.", nameof(beneficiaryAccountId));
        if (allocatedAmount.Value == 0)
            throw new ArgumentOutOfRangeException(nameof(allocatedAmount), "Approved amount must be positive.");
        if (string.IsNullOrWhiteSpace(fundingSourceReference))
            throw new ArgumentException("Funding source reference is required.", nameof(fundingSourceReference));
        if (string.IsNullOrWhiteSpace(eligibilityVersion))
            throw new ArgumentException("Eligibility version is required.", nameof(eligibilityVersion));
        if (string.IsNullOrWhiteSpace(approvalAuditReference))
            throw new ArgumentException("Approval audit reference is required.", nameof(approvalAuditReference));

        var startUtc = effectiveAt.ToUniversalTime();
        var endUtc = expiresAt?.ToUniversalTime();

        if (endUtc <= startUtc)
            throw new ArgumentOutOfRangeException(nameof(expiresAt),
                "Expiry must be strictly after effective time.");

        return new ApprovedCreditAllocation(
            allocationId, fundingSourceReference.Trim(), programId, organizationId,
            beneficiaryAccountId, allocatedAmount, eligibilityVersion.Trim(), startUtc,
            endUtc, approvalAuditReference.Trim());
    }

    public bool IsWithinValidityWindow(DateTimeOffset instant)
    {
        var utc = instant.ToUniversalTime();
        return utc >= EffectiveAtUtc && (ExpiresAtUtc is null || utc < ExpiresAtUtc);
    }
}
