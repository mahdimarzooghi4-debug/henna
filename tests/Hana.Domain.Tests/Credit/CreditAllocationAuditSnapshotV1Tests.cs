using Hana.Domain.Credit;
using Hana.Domain.Money;

namespace Hana.Domain.Tests;

public sealed class CreditAllocationAuditSnapshotV1Tests
{
    private static readonly DateTimeOffset CapturedAtUtc =
        new(2026, 9, 27, 14, 30, 0, TimeSpan.Zero);

    [Fact]
    public void EqualTopUpSnapshotCarriesSourceAndExactAmountWithoutNeedData()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.EqualWalletTopUp,
            "donor-42",
            "instruction-2026-04");
        var allocation = CreditFundingInstructionResolverV1.CalculateEqualWalletTopUp(
            instruction, new RialAmount(10_000_000));

        var snapshot = CreditAllocationAuditSnapshotV1.Capture(
            Guid.Parse("8dfc0e8a-6e9c-4d8b-b553-cf34c4590e10"),
            CapturedAtUtc,
            allocation);

        Assert.Equal(CapturedAtUtc, snapshot.CapturedAtUtc);
        Assert.Equal("donor-42", snapshot.FundingSourceReference);
        Assert.Equal("instruction-2026-04", snapshot.InstructionReference);
        Assert.Equal(CreditAllocationModeV1.EqualWalletTopUp, snapshot.AllocationMode);
        Assert.Equal(new RialAmount(10_000_000), snapshot.BaseAmount);
        Assert.Equal(new RialAmount(10_000_000), snapshot.PayableAmount);
        Assert.Null(snapshot.HouseholdScores);
        Assert.Null(snapshot.GeographyDatasetVersion);
        Assert.Null(snapshot.GeographicFactor);
        Assert.Null(snapshot.FormulaVersion);
    }

    [Fact]
    public void OrganizationDefinedSnapshotCarriesSelectedAmountWithoutNeedData()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.OrganizationDefined,
            "org-program-17",
            "instruction-2026-05");
        var allocation = CreditFundingInstructionResolverV1.CalculateOrganizationDefined(
            instruction, new RialAmount(8_000_000));

        var snapshot = CreditAllocationAuditSnapshotV1.Capture(
            Guid.Parse("a996fbf9-10fa-4c2c-98f1-b85c9919ed60"), CapturedAtUtc, allocation);

        Assert.Equal(CreditFundingSourceV1.Organization, snapshot.FundingSource);
        Assert.Equal(CreditAllocationModeV1.OrganizationDefined, snapshot.AllocationMode);
        Assert.Equal(new RialAmount(8_000_000), snapshot.PayableAmount);
        Assert.Null(snapshot.HouseholdScores);
        Assert.Null(snapshot.GeographyDatasetVersion);
    }

    [Fact]
    public void SnapshotRejectsForgedHanaCharityEqualTopUp()
    {
        var equal = CreditAllocationModesV1.CalculateEqualWalletTopUp(new RialAmount(1));
        var forged = new CreditProgramAllocationV1(
            CreditFundingInstructionResolverV1.PolicyVersion,
            CreditFundingSourceV1.HanaCharityFund,
            "hana-charity-fund",
            "fund-decision-26",
            null,
            CreditAllocationModeV1.EqualWalletTopUp,
            equal.Household,
            null);

        Assert.Throws<ArgumentException>(() => CreditAllocationAuditSnapshotV1.Capture(
            Guid.NewGuid(), CapturedAtUtc, forged));
    }

    [Fact]
    public void NeedsBasedSnapshotCarriesVersionsMappedScoresGeographyAndMoneyBreakdown()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Donor,
            CreditAllocationModeV1.NeedsBased,
            "donor-42",
            "donor-instruction-8",
            "authorization-3");
        var allocation = CreditFundingInstructionResolverV1.CalculateNeedsBasedForCity(
            instruction,
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            "زنجان",
            "زنجان",
            Assessment());

        var snapshot = CreditAllocationAuditSnapshotV1.Capture(
            Guid.Parse("bb8e0a82-170f-4855-a475-327451569bc9"),
            CapturedAtUtc,
            allocation);

        Assert.Equal(CreditAllocationModeV1.NeedsBased, snapshot.AllocationMode);
        Assert.Equal("authorization-3", snapshot.NeedsBasedAuthorizationReference);
        Assert.Equal(NeedsBasedHouseholdQuoteCalculatorV1.FormulaVersion, snapshot.FormulaVersion);
        Assert.Equal(HouseholdNeedScoringV1.Version, snapshot.HouseholdScoringVersion);
        Assert.Equal(GeographicAllocationDatasetV1.Version, snapshot.GeographyDatasetVersion);
        Assert.Equal("زنجان", snapshot.ProvinceName);
        Assert.Equal("زنجان", snapshot.CityName);
        Assert.True(snapshot.IsUrban);
        Assert.True(snapshot.IsProvincialCapital);
        Assert.NotNull(snapshot.HouseholdScores);
        Assert.Equal(allocation.HouseholdAllocation.PayableAmount, snapshot.PayableAmount);
        Assert.Equal(allocation.HouseholdAllocation.UnusedFromBase, snapshot.UnusedFromBase);
    }

    [Fact]
    public void RequiresNonEmptyCalculationIdAndUtcTimestamp()
    {
        var instruction = new CreditFundingInstructionV1(
            CreditFundingSourceV1.Organization,
            CreditAllocationModeV1.OrganizationDefined,
            "org-program-17",
            "instruction-2026-05");
        var allocation = CreditFundingInstructionResolverV1.CalculateOrganizationDefined(
            instruction, new RialAmount(1));

        Assert.Throws<ArgumentException>(() =>
            CreditAllocationAuditSnapshotV1.Capture(Guid.Empty, CapturedAtUtc, allocation));
        Assert.Throws<ArgumentException>(() =>
            CreditAllocationAuditSnapshotV1.Capture(
                Guid.NewGuid(), CapturedAtUtc.ToOffset(TimeSpan.FromHours(3.5)), allocation));
    }

    private static HouseholdNeedAssessmentInput Assessment() => new()
    {
        HealthBurden = HealthBurdenLevel.OneManageableOngoingCase,
        EconomicHardship = EconomicHardshipLevel.OccasionalShortfallInOneEssentialNeed,
        CareAndSupport = CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
        Education = EducationAttainment.DiplomaOrAssociate,
        HouseholdSize = 1,
        AgeComposition = new HouseholdAgeComposition(0, 0, 0, 1, 0, 0)
    };
}
