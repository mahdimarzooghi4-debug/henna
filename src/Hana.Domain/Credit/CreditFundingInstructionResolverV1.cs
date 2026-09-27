using Hana.Domain.Money;

namespace Hana.Domain.Credit;

public enum CreditFundingSourceV1
{
    Organization = 1,
    HanaCharityFund = 2,
    Donor = 3
}

public sealed record CreditFundingInstructionV1
{
    public CreditFundingSourceV1 FundingSource { get; }
    public CreditAllocationModeV1 AllocationMode { get; }
    public string FundingSourceReference { get; }
    public string InstructionReference { get; }
    public string? NeedsBasedAuthorizationReference { get; }

    public CreditFundingInstructionV1(
        CreditFundingSourceV1 fundingSource,
        CreditAllocationModeV1 allocationMode,
        string fundingSourceReference,
        string instructionReference,
        string? needsBasedAuthorizationReference = null)
    {
        if (!Enum.IsDefined(fundingSource))
            throw new ArgumentOutOfRangeException(nameof(fundingSource));
        if (!Enum.IsDefined(allocationMode))
            throw new ArgumentOutOfRangeException(nameof(allocationMode));
        if (string.IsNullOrWhiteSpace(fundingSourceReference))
            throw new ArgumentException("A funding source reference is required.", nameof(fundingSourceReference));
        if (string.IsNullOrWhiteSpace(instructionReference))
            throw new ArgumentException("An explicit funding instruction reference is required.", nameof(instructionReference));

        FundingSource = fundingSource;
        AllocationMode = allocationMode;
        FundingSourceReference = fundingSourceReference.Trim();
        InstructionReference = instructionReference.Trim();
        NeedsBasedAuthorizationReference = string.IsNullOrWhiteSpace(needsBasedAuthorizationReference)
            ? null
            : needsBasedAuthorizationReference.Trim();
    }
}

/// <summary>
/// Calculation result with source and instruction references carried for a
/// future persistent audit boundary. Creating this value does not verify the
/// referenced evidence or write an audit record.
/// </summary>
public sealed record CreditProgramAllocationV1(
    string SourcePolicyVersion,
    CreditFundingSourceV1 FundingSource,
    string FundingSourceReference,
    string InstructionReference,
    string? NeedsBasedAuthorizationReference,
    CreditAllocationModeV1 AllocationMode,
    HouseholdAllocationResult HouseholdAllocation,
    NeedsBasedHouseholdQuoteV1? NeedsBasedQuote);

/// <summary>
/// Binds an explicitly referenced funding instruction to one allocation path.
/// Evidence must be resolved by a trusted application boundary before calling.
/// </summary>
public static class CreditFundingInstructionResolverV1
{
    public const string PolicyVersion = "HANA-CREDIT-FUNDING-POLICY-v1";

    public static CreditProgramAllocationV1 CalculateEqualWalletTopUp(
        CreditFundingInstructionV1 instruction,
        RialAmount amount)
    {
        ValidateInstruction(instruction, CreditAllocationModeV1.EqualWalletTopUp);

        var result = CreditAllocationModesV1.CalculateEqualWalletTopUp(amount);
        return CreateResult(instruction, result.Household, needsBasedQuote: null);
    }

    public static CreditProgramAllocationV1 CalculateNeedsBasedForCity(
        CreditFundingInstructionV1 instruction,
        RialAmount baseAmount,
        RialAmount ceiling,
        string provinceName,
        string cityName,
        HouseholdNeedAssessmentInput assessment)
    {
        ValidateInstruction(instruction, CreditAllocationModeV1.NeedsBased);

        var quote = NeedsBasedHouseholdQuoteCalculatorV1.ForCity(
            baseAmount, ceiling, provinceName, cityName, assessment);
        return CreateResult(instruction, quote.Allocation, quote);
    }

    public static CreditProgramAllocationV1 CalculateNeedsBasedForNonCity(
        CreditFundingInstructionV1 instruction,
        RialAmount baseAmount,
        RialAmount ceiling,
        string provinceName,
        HouseholdNeedAssessmentInput assessment)
    {
        ValidateInstruction(instruction, CreditAllocationModeV1.NeedsBased);

        var quote = NeedsBasedHouseholdQuoteCalculatorV1.ForNonCity(
            baseAmount, ceiling, provinceName, assessment);
        return CreateResult(instruction, quote.Allocation, quote);
    }

    private static void ValidateInstruction(
        CreditFundingInstructionV1 instruction,
        CreditAllocationModeV1 requiredMode)
    {
        ArgumentNullException.ThrowIfNull(instruction);
        if (instruction.AllocationMode != requiredMode)
            throw new InvalidOperationException("Funding instruction does not authorize this allocation path.");

        if (requiredMode != CreditAllocationModeV1.NeedsBased)
            return;

        if (instruction.FundingSource == CreditFundingSourceV1.Organization)
            throw new InvalidOperationException(
                "Needs-based allocation is not permitted for an organization-directed funding instruction.");
        if (instruction.FundingSource == CreditFundingSourceV1.Donor &&
            instruction.NeedsBasedAuthorizationReference is null)
            throw new InvalidOperationException(
                "Needs-based allocation requires an explicit donor authorization reference.");
    }

    private static CreditProgramAllocationV1 CreateResult(
        CreditFundingInstructionV1 instruction,
        HouseholdAllocationResult allocation,
        NeedsBasedHouseholdQuoteV1? needsBasedQuote) =>
        new(
            PolicyVersion,
            instruction.FundingSource,
            instruction.FundingSourceReference,
            instruction.InstructionReference,
            instruction.NeedsBasedAuthorizationReference,
            instruction.AllocationMode,
            allocation,
            needsBasedQuote);
}
