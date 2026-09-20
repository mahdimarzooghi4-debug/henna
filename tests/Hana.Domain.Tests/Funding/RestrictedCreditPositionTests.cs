using Hana.Domain.Funding;
using Hana.Domain.Money;

namespace Hana.Domain.Tests.Funding;

public sealed class RestrictedCreditPositionTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 20, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset End = Start.AddDays(30);

    private static ApprovedCreditAllocation Approved(
        long amount = 1_000,
        DateTimeOffset? expiry = null,
        Guid? organizationId = null) =>
        ApprovedCreditAllocation.FromApprovedDecision(
            allocationId: Guid.NewGuid(),
            fundingSourceReference: "verified-source-reference",
            programId: Guid.NewGuid(),
            organizationId: organizationId,
            beneficiaryAccountId: Guid.NewGuid(),
            allocatedAmount: new RialAmount(amount),
            eligibilityVersion: "eligibility-v1",
            effectiveAt: Start,
            expiresAt: expiry,
            approvalAuditReference: "approved-decision-reference");

    [Fact]
    public void ValidApprovedAllocationRequiresFundingAndApprovalReferences()
    {
        var valid = Approved();
        Assert.Equal("verified-source-reference", valid.FundingSourceReference);
        Assert.Equal("approved-decision-reference", valid.ApprovalAuditReference);
        Assert.Equal(1_000, valid.AllocatedAmount.Value);
    }

    [Fact]
    public void RejectedWithoutAnAuditableApproval()
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            ApprovedCreditAllocation.FromApprovedDecision(
                Guid.NewGuid(), "source", Guid.NewGuid(), null, Guid.NewGuid(),
                new RialAmount(100), "v1", Start, null, " "));
        Assert.Equal("approvalAuditReference", exception.ParamName);
    }

    [Fact]
    public void RejectedWithoutFundingSourceOrEligibilityVersion()
    {
        Assert.Throws<ArgumentException>(() =>
            ApprovedCreditAllocation.FromApprovedDecision(
                Guid.NewGuid(), "", Guid.NewGuid(), null, Guid.NewGuid(),
                new RialAmount(100), "v1", Start, null, "decision"));

        Assert.Throws<ArgumentException>(() =>
            ApprovedCreditAllocation.FromApprovedDecision(
                Guid.NewGuid(), "source", Guid.NewGuid(), null, Guid.NewGuid(),
                new RialAmount(100), "", Start, null, "decision"));
    }

    [Fact]
    public void RegistrationIdAloneDoesNotCreateAValidAllocation()
    {
        Assert.Throws<ArgumentException>(() =>
            ApprovedCreditAllocation.FromApprovedDecision(
                Guid.Empty, "source", Guid.NewGuid(), null, Guid.NewGuid(),
                new RialAmount(100), "v1", Start, null, "decision"));

        Assert.Throws<ArgumentOutOfRangeException>(() => Approved(amount: 0));
    }

    [Fact]
    public void OrganizationOwnershipIsPreservedAndOptional()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, Approved(organizationId: id).OrganizationId);
        Assert.Null(Approved().OrganizationId);
    }

    [Fact]
    public void ExpiresAtIsExclusiveAndDatesAreNormalizedToUtc()
    {
        var tehranTime = new DateTimeOffset(2026, 9, 20, 3, 30, 0, TimeSpan.FromHours(3.5));
        var allocation = ApprovedCreditAllocation.FromApprovedDecision(
            Guid.NewGuid(), "source", Guid.NewGuid(), null, Guid.NewGuid(),
            new RialAmount(100), "v1", tehranTime, End, "decision");
        Assert.Equal(TimeSpan.Zero, allocation.EffectiveAtUtc.Offset);
        Assert.Equal(Start, allocation.EffectiveAtUtc);
        Assert.True(allocation.IsWithinValidityWindow(Start));
        Assert.True(allocation.IsWithinValidityWindow(End.AddTicks(-1)));
        Assert.False(allocation.IsWithinValidityWindow(End));
        Assert.False(allocation.IsWithinValidityWindow(Start.AddTicks(-1)));
    }

    [Fact]
    public void InvalidExpiryIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Approved(expiry: Start));
    }

    [Fact]
    public void ApprovedAmountCannotBeOverAllocatedInProjection()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new RestrictedCreditPosition(Approved(), new RialAmount(800),
                new RialAmount(200), new RialAmount(1)));
    }

    [Fact]
    public void ReservationsConsumptionAndExpiryDoNotCreateWithdrawableCash()
    {
        var position = new RestrictedCreditPosition(
            Approved(), new RialAmount(200), new RialAmount(300), new RialAmount(100));

        Assert.Equal(400, position.Uncommitted.Value);
        Assert.True(position.CanReserve(new RialAmount(400), Start));
        Assert.False(position.CanReserve(new RialAmount(401), Start));
        Assert.False(position.CanReserve(new RialAmount(0), Start));
    }

    [Fact]
    public void OutsideValidityWindowNoCreditIsSpendable()
    {
        var position = new RestrictedCreditPosition(
            Approved(expiry: End), new RialAmount(0),
            new RialAmount(0), new RialAmount(0));
        Assert.Equal(1_000, position.Uncommitted.Value);
        Assert.Equal(0, position.AvailableAt(End).Value);
        Assert.False(position.CanReserve(new RialAmount(1), End));
    }

    [Fact]
    public void FinancialTotalsCannotOverflow()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new RestrictedCreditPosition(Approved(),
                new RialAmount(long.MaxValue), new RialAmount(1), new RialAmount(0)));
    }
}
