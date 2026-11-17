using Hana.Domain.Credit;
using Hana.Domain.Money;

namespace Hana.Domain.Tests;

public sealed class CreditFundingInstructionResolverV1Tests
{
    [Fact]
    public void OrganizationInstructionUsesItsExplicitBeneficiaryAmountExactly()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.OrganizationDefined,
            "org-program-17",
            "instruction-2026-04");

        var result = CreditFundingInstructionResolverV1.CalculateOrganizationDefined(
            instruction, new RialAmount(10_000_000));

        Assert.Equal(CreditFundingInstructionResolverV1.PolicyVersion, result.SourcePolicyVersion);
        Assert.Equal(CreditFundingSourceV1.Organization, result.FundingSource);
        Assert.Equal("org-program-17", result.FundingSourceReference);
        Assert.Equal("instruction-2026-04", result.InstructionReference);
        Assert.Equal(CreditAllocationModeV1.OrganizationDefined, result.AllocationMode);
        Assert.Equal(new RialAmount(10_000_000), result.HouseholdAllocation.PayableAmount);
        Assert.Null(result.NeedsBasedQuote);
    }

    [Fact]
    public void OrganizationCannotUseEqualTopUpAsAThirdCollaborationMode()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.EqualWalletTopUp,
            "org-program-17",
            "instruction-2026-04");

        Assert.Throws<InvalidOperationException>(() =>
            CreditFundingInstructionResolverV1.CalculateEqualWalletTopUp(
                instruction, new RialAmount(10_000_000)));
    }

    [Fact]
    public void HanaCharityFundMayExplicitlySelectNeedsBasedCalculation()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.HanaCharityFund,
            CreditAllocationModeV1.NeedsBased,
            "hana-charity-fund",
            "fund-decision-23");

        var result = CreditFundingInstructionResolverV1.CalculateNeedsBasedForCity(
            instruction,
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            "ابهر",
            MinimumAssessment());

        Assert.Equal(CreditAllocationModeV1.NeedsBased, result.AllocationMode);
        Assert.Equal("fund-decision-23", result.InstructionReference);
        Assert.NotNull(result.NeedsBasedQuote);
        Assert.Equal(GeographicAllocationDatasetV1.Version,
            result.NeedsBasedQuote.GeographyDatasetVersion);
    }

    [Fact]
    public void OrganizationMaySelectHennaNeedsBasedCalculation()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.NeedsBased,
            "org-program-17",
            "instruction-2026-05");

        var result = CreditFundingInstructionResolverV1.CalculateNeedsBasedForCity(
            instruction,
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            "ابهر",
            MinimumAssessment());

        Assert.Equal(CreditFundingSourceV1.Organization, result.FundingSource);
        Assert.Equal(CreditAllocationModeV1.NeedsBased, result.AllocationMode);
        Assert.Equal("HANA-CREDIT-FUNDING-POLICY-v2", result.SourcePolicyVersion);
        Assert.NotNull(result.NeedsBasedQuote);
    }

    [Fact]
    public void HanaCharityFundCannotSelectEqualTopUp()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.HanaCharityFund,
            CreditAllocationModeV1.EqualWalletTopUp,
            "hana-charity-fund",
            "fund-decision-24");

        Assert.Throws<InvalidOperationException>(() =>
            CreditFundingInstructionResolverV1.CalculateEqualWalletTopUp(
                instruction, new RialAmount(10_000_000)));
    }

    [Fact]
    public void OnlyOrganizationMaySelectOrganizationDefinedAmounts()
    {
        var donorInstruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.OrganizationDefined,
            "donor-42",
            "donor-instruction-10");

        Assert.Throws<InvalidOperationException>(() =>
            CreditFundingInstructionResolverV1.CalculateOrganizationDefined(
                donorInstruction, new RialAmount(10_000_000)));
    }

    [Fact]
    public void DonorNeedsBasedInstructionRequiresExplicitAuthorizationReference()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.NeedsBased,
            "donor-42",
            "donor-instruction-8");

        Assert.Throws<InvalidOperationException>(() =>
            CreditFundingInstructionResolverV1.CalculateNeedsBasedForNonCity(
                instruction,
                new RialAmount(10),
                new RialAmount(10),
                "زنجان",
                MinimumAssessment()));
    }

    [Fact]
    public void ExplicitlyAuthorizedDonorMaySelectNeedsBasedCalculation()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.NeedsBased,
            "donor-42",
            "donor-instruction-8",
            "authorization-3");

        var result = CreditFundingInstructionResolverV1.CalculateNeedsBasedForNonCity(
            instruction,
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            MinimumAssessment());

        Assert.Equal("authorization-3", result.NeedsBasedAuthorizationReference);
        Assert.NotNull(result.NeedsBasedQuote);
    }

    [Fact]
    public void FundingInstructionModeCannotBeOverridden()
    {
        var equalDonor = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.EqualWalletTopUp,
            "donor-42",
            "donor-instruction-9");

        Assert.Throws<InvalidOperationException>(() =>
            CreditFundingInstructionResolverV1.CalculateNeedsBasedForCity(
                equalDonor,
                new RialAmount(10),
                new RialAmount(10),
                "زنجان",
                "ابهر",
                MinimumAssessment()));
    }

    [Fact]
    public void InstructionReferencesAreRequired()
    {
        Assert.Throws<ArgumentException>(() => new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.OrganizationDefined,
            " ",
            "instruction-1"));
        Assert.Throws<ArgumentException>(() => new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.OrganizationDefined,
            "org-1",
            " "));
    }

    private static HouseholdNeedAssessmentInput MinimumAssessment() => new()
    {
        HealthBurden = HealthBurdenLevel.NoOngoingTreatment,
        EconomicHardship = EconomicHardshipLevel.EssentialNeedsGenerallyMet,
        CareAndSupport = CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
        Education = EducationAttainment.BachelorOrHigher,
        HousingTenure = HousingTenureType.Owner,
        HouseholdSize = 1,
        AgeComposition = new HouseholdAgeComposition(0, 0, 0, 1, 0, 0)
    };
}
