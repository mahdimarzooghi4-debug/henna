using Hana.Domain.Money;

namespace Hana.Domain.Credit;

/// <summary>
/// Immutable calculation provenance prepared for later durable audit storage.
/// Raw qualitative assessment details are intentionally not copied; the mapped
/// scores and exact formula/dataset versions are sufficient to reproduce math.
/// </summary>
public sealed record CreditAllocationAuditSnapshotV1
{
    public Guid CalculationId { get; }
    public DateTimeOffset CapturedAtUtc { get; }
    public string SourcePolicyVersion { get; }
    public CreditFundingSourceV1 FundingSource { get; }
    public string FundingSourceReference { get; }
    public string InstructionReference { get; }
    public string? NeedsBasedAuthorizationReference { get; }
    public CreditAllocationModeV1 AllocationMode { get; }
    public string? FormulaVersion { get; }
    public string? HouseholdScoringVersion { get; }
    public string? GeographyDatasetVersion { get; }
    public string? ProvinceName { get; }
    public string? CityName { get; }
    public bool? IsUrban { get; }
    public bool? IsProvincialCapital { get; }
    public decimal? RawMpi { get; }
    public decimal? MinimumMpi { get; }
    public decimal? MaximumMpi { get; }
    public decimal? GeographicFactor { get; }
    public decimal? HouseholdFactor { get; }
    public HouseholdNeedScores? HouseholdScores { get; }
    public RialAmount BaseAmount { get; }
    public RialAmount Ceiling { get; }
    public RialAmount CalculatedAmount { get; }
    public RialAmount PayableAmount { get; }
    public RialAmount UnusedFromBase { get; }

    private CreditAllocationAuditSnapshotV1(
        Guid calculationId,
        DateTimeOffset capturedAtUtc,
        string sourcePolicyVersion,
        CreditFundingSourceV1 fundingSource,
        string fundingSourceReference,
        string instructionReference,
        string? needsBasedAuthorizationReference,
        CreditAllocationModeV1 allocationMode,
        string? formulaVersion,
        string? householdScoringVersion,
        string? geographyDatasetVersion,
        string? provinceName,
        string? cityName,
        bool? isUrban,
        bool? isProvincialCapital,
        decimal? rawMpi,
        decimal? minimumMpi,
        decimal? maximumMpi,
        decimal? geographicFactor,
        decimal? householdFactor,
        HouseholdNeedScores? householdScores,
        RialAmount baseAmount,
        RialAmount ceiling,
        RialAmount calculatedAmount,
        RialAmount payableAmount,
        RialAmount unusedFromBase)
    {
        CalculationId = calculationId;
        CapturedAtUtc = capturedAtUtc;
        SourcePolicyVersion = sourcePolicyVersion;
        FundingSource = fundingSource;
        FundingSourceReference = fundingSourceReference;
        InstructionReference = instructionReference;
        NeedsBasedAuthorizationReference = needsBasedAuthorizationReference;
        AllocationMode = allocationMode;
        FormulaVersion = formulaVersion;
        HouseholdScoringVersion = householdScoringVersion;
        GeographyDatasetVersion = geographyDatasetVersion;
        ProvinceName = provinceName;
        CityName = cityName;
        IsUrban = isUrban;
        IsProvincialCapital = isProvincialCapital;
        RawMpi = rawMpi;
        MinimumMpi = minimumMpi;
        MaximumMpi = maximumMpi;
        GeographicFactor = geographicFactor;
        HouseholdFactor = householdFactor;
        HouseholdScores = householdScores;
        BaseAmount = baseAmount;
        Ceiling = ceiling;
        CalculatedAmount = calculatedAmount;
        PayableAmount = payableAmount;
        UnusedFromBase = unusedFromBase;
    }

    public static CreditAllocationAuditSnapshotV1 Capture(
        Guid calculationId,
        DateTimeOffset capturedAtUtc,
        CreditProgramAllocationV1 allocation)
    {
        if (calculationId == Guid.Empty)
            throw new ArgumentException("A calculation ID is required.", nameof(calculationId));
        if (capturedAtUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("Capture time must be UTC.", nameof(capturedAtUtc));
        ArgumentNullException.ThrowIfNull(allocation);

        if (!Enum.IsDefined(allocation.FundingSource) ||
            !Enum.IsDefined(allocation.AllocationMode))
            throw new ArgumentOutOfRangeException(nameof(allocation));
        if (allocation.SourcePolicyVersion != CreditFundingInstructionResolverV1.PolicyVersion)
            throw new ArgumentException("Unsupported source policy version.", nameof(allocation));
        ArgumentNullException.ThrowIfNull(allocation.HouseholdAllocation);

        if (allocation.AllocationMode == CreditAllocationModeV1.EqualWalletTopUp)
        {
            if (allocation.NeedsBasedQuote is not null)
                throw new ArgumentException("Equal top-ups cannot carry a needs-based quote.", nameof(allocation));

            return new CreditAllocationAuditSnapshotV1(
                calculationId: calculationId,
                capturedAtUtc: capturedAtUtc,
                sourcePolicyVersion: allocation.SourcePolicyVersion,
                fundingSource: allocation.FundingSource,
                fundingSourceReference: allocation.FundingSourceReference,
                instructionReference: allocation.InstructionReference,
                needsBasedAuthorizationReference: allocation.NeedsBasedAuthorizationReference,
                allocationMode: allocation.AllocationMode,
                formulaVersion: null,
                householdScoringVersion: null,
                geographyDatasetVersion: null,
                provinceName: null,
                cityName: null,
                isUrban: null,
                isProvincialCapital: null,
                rawMpi: null,
                minimumMpi: null,
                maximumMpi: null,
                geographicFactor: null,
                householdFactor: null,
                householdScores: null,
                baseAmount: allocation.HouseholdAllocation.CalculatedAmount,
                ceiling: allocation.HouseholdAllocation.PayableAmount,
                calculatedAmount: allocation.HouseholdAllocation.CalculatedAmount,
                payableAmount: allocation.HouseholdAllocation.PayableAmount,
                unusedFromBase: allocation.HouseholdAllocation.UnusedFromBase);
        }

        if (allocation.AllocationMode != CreditAllocationModeV1.NeedsBased ||
            allocation.NeedsBasedQuote is null)
            throw new ArgumentException("Needs-based instructions require a needs-based quote.", nameof(allocation));

        var quote = allocation.NeedsBasedQuote;
        var geography = quote.Geography;
        return new CreditAllocationAuditSnapshotV1(
            calculationId: calculationId,
            capturedAtUtc: capturedAtUtc,
            sourcePolicyVersion: allocation.SourcePolicyVersion,
            fundingSource: allocation.FundingSource,
            fundingSourceReference: allocation.FundingSourceReference,
            instructionReference: allocation.InstructionReference,
            needsBasedAuthorizationReference: allocation.NeedsBasedAuthorizationReference,
            allocationMode: allocation.AllocationMode,
            formulaVersion: quote.FormulaVersion,
            householdScoringVersion: quote.HouseholdScoringVersion,
            geographyDatasetVersion: quote.GeographyDatasetVersion,
            provinceName: geography.ProvinceName,
            cityName: geography.CityName,
            isUrban: geography.IsUrban,
            isProvincialCapital: geography.IsProvincialCapital,
            rawMpi: geography.RawMpi,
            minimumMpi: geography.MinimumMpi,
            maximumMpi: geography.MaximumMpi,
            geographicFactor: quote.Allocation.GeographicFactor,
            householdFactor: quote.Allocation.HouseholdFactor,
            householdScores: quote.HouseholdScores,
            baseAmount: quote.BaseAmount,
            ceiling: quote.Ceiling,
            calculatedAmount: quote.Allocation.CalculatedAmount,
            payableAmount: quote.Allocation.PayableAmount,
            unusedFromBase: quote.Allocation.UnusedFromBase);
    }
}
