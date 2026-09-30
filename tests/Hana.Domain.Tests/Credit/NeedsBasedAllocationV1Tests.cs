using Hana.Domain.Credit;
using Hana.Domain.Money;

namespace Hana.Domain.Tests;

public sealed class NeedsBasedAllocationV1Tests
{
    private static readonly HouseholdNeedScores NoScoredNeeds = new(0, 0, 0, 0, 0, 0);

    [Fact]
    public void HouseholdFactorUsesApprovedWeightsAndZeroToThreeScale()
    {
        Assert.Equal(1m, NeedsBasedAllocationV1.CalculateHouseholdFactor(NoScoredNeeds));
        Assert.Equal(1.5m, NeedsBasedAllocationV1.CalculateHouseholdFactor(
            new HouseholdNeedScores(3, 3, 3, 3, 3, 3)));
        Assert.Equal(1.15m, NeedsBasedAllocationV1.CalculateHouseholdFactor(
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0)));
        Assert.Equal(1.025m, NeedsBasedAllocationV1.CalculateHouseholdFactor(
            new HouseholdNeedScores(0, 0, 0, 0, 0, 3)));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(4)]
    public void HouseholdScoresOutsideZeroToThreeAreRejected(int invalidScore)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new HouseholdNeedScores(invalidScore, 0, 0, 0, 0, 0));
    }

    [Fact]
    public void GeographyIsNormalizedAndProvincialCapitalGetsTwentyPercentAdjustment()
    {
        Assert.Equal(0.8m, NeedsBasedAllocationV1.CalculateGeographicFactor(
            0.1m, 0.1m, 0.2m, isProvincialCapital: false));
        Assert.Equal(1.2m, NeedsBasedAllocationV1.CalculateGeographicFactor(
            0.2m, 0.1m, 0.2m, isProvincialCapital: false));
        Assert.Equal(0.96m, NeedsBasedAllocationV1.CalculateGeographicFactor(
            0.1m, 0.1m, 0.2m, isProvincialCapital: true));
    }

    [Fact]
    public void PerHouseholdCalculationProducesTenMillionInZahedanAndEightMillionInYazdExample()
    {
        var baseAmount = new RialAmount(100_000_000);

        var zahedan = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount, baseAmount, 1m, NoScoredNeeds);
        var yazd = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount, baseAmount, 0.8m, NoScoredNeeds);

        Assert.Equal(100_000_000, zahedan.PayableAmount.Value);
        Assert.Equal(80_000_000, yazd.PayableAmount.Value);
        Assert.Equal(0, zahedan.UnusedFromBase.Value);
        Assert.Equal(20_000_000, yazd.UnusedFromBase.Value);
    }

    [Fact]
    public void HouseholdAmountsAreCappedIndependentlyAndUnusedBalanceIsNotAllocated()
    {
        var baseAmount = new RialAmount(100_000_000);
        var result = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount,
            baseAmount,
            geographicFactor: 1.2m,
            scores: new HouseholdNeedScores(3, 3, 3, 3, 3, 3));

        Assert.Equal(180_000_000, result.CalculatedAmount.Value);
        Assert.Equal(100_000_000, result.PayableAmount.Value);
        Assert.Equal(0, result.UnusedFromBase.Value);
    }

    [Fact]
    public void BelowBaseResultKeepsUnusedAmountOnThatHousehold()
    {
        var baseAmount = new RialAmount(100_000_000);
        var result = NeedsBasedAllocationV1.CalculatePerHousehold(
            baseAmount, baseAmount, 0.8m, NoScoredNeeds);

        Assert.Equal(80_000_000, result.PayableAmount.Value);
        Assert.Equal(20_000_000, result.UnusedFromBase.Value);
    }

    [Fact]
    public void InvalidGeographyBoundsAndNonPositiveFactorsAreRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            NeedsBasedAllocationV1.CalculateGeographicFactor(0.1m, 0.1m, 0.1m, false));

        var amount = new RialAmount(100_000_000);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            NeedsBasedAllocationV1.CalculatePerHousehold(amount, amount, 0m, NoScoredNeeds));
    }
}
