using Hana.Domain.Credit;
using Hana.Domain.Money;

namespace Hana.Domain.Tests;

public sealed class CreditAllocationModesV1Tests
{
    [Fact]
    public void OrganizationDefinedModePreservesTheExplicitBeneficiaryAmount()
    {
        var amount = new RialAmount(8_000_000);

        var result = CreditAllocationModesV1.CalculateOrganizationDefined(amount);

        Assert.Equal(CreditAllocationModeV1.OrganizationDefined, result.Mode);
        Assert.Equal(amount, result.Household.CalculatedAmount);
        Assert.Equal(amount, result.Household.PayableAmount);
        Assert.Equal(1m, result.Household.GeographicFactor);
        Assert.Equal(1m, result.Household.HouseholdFactor);
    }

    [Fact]
    public void EqualWalletTopUpReturnsTheSameAmountWithoutNeedFactors()
    {
        var amount = new RialAmount(10_000_000);

        var result = CreditAllocationModesV1.CalculateEqualWalletTopUp(amount);

        Assert.Equal(CreditAllocationModeV1.EqualWalletTopUp, result.Mode);
        Assert.Equal(amount, result.Household.CalculatedAmount);
        Assert.Equal(amount, result.Household.PayableAmount);
        Assert.Equal(new RialAmount(0), result.Household.UnusedFromBase);
        Assert.Equal(1m, result.Household.GeographicFactor);
        Assert.Equal(1m, result.Household.HouseholdFactor);
    }

    [Fact]
    public void NeedsBasedModeUsesTheExistingVersionedFactorsAndCeiling()
    {
        var scores = new HouseholdNeedScores(
            health: 0, economicHardship: 0, ageAndDependency: 0m,
            householdSize: 0m, careAndSupport: 0, education: 0);

        var result = CreditAllocationModesV1.CalculateNeedsBased(
            new RialAmount(10_000_000),
            new RialAmount(10_000_000),
            geographicFactor: 0.8m,
            scores);

        Assert.Equal(CreditAllocationModeV1.NeedsBased, result.Mode);
        Assert.Equal(new RialAmount(8_000_000), result.Household.CalculatedAmount);
        Assert.Equal(new RialAmount(8_000_000), result.Household.PayableAmount);
        Assert.Equal(new RialAmount(2_000_000), result.Household.UnusedFromBase);
    }

    [Fact]
    public void EqualWalletTopUpRejectsZeroAmount()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CreditAllocationModesV1.CalculateEqualWalletTopUp(new RialAmount(0)));
    }

    [Fact]
    public void OrganizationDefinedModeRejectsZeroBeneficiaryAmount()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CreditAllocationModesV1.CalculateOrganizationDefined(new RialAmount(0)));
    }

    [Fact]
    public void NeedsBasedModePreservesExistingInputValidation()
    {
        var scores = new HouseholdNeedScores(
            health: 0, economicHardship: 0, ageAndDependency: 0m,
            householdSize: 0m, careAndSupport: 0, education: 0);

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CreditAllocationModesV1.CalculateNeedsBased(
                new RialAmount(10),
                new RialAmount(10),
                geographicFactor: 0m,
                scores));
    }
}
