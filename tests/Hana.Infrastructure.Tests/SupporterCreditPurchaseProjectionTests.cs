using Hana.Infrastructure.Commerce;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class SupporterCreditPurchaseProjectionTests
{
    private static CreditGrant Grant(Guid account, Guid program) => new(
        Guid.NewGuid(), account, program, 2000, 2000,
        DateTimeOffset.UtcNow.AddDays(7), new List<Guid> { Guid.NewGuid() },
        Guid.NewGuid());

    private static OrderItem Item(long credit, long cash = 0,
        int quantity = 1, int returned = 0, string? name = "Item") =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            quantity, (cash + credit) / quantity, cash, credit, returned, name);

    private static Order Purchase(CreditGrant grant, params OrderItem[] items) =>
        new(Guid.NewGuid(), grant.AccountId, Guid.NewGuid(),
            "PERSONAL", "PICKUP",
            new BuyerAddress(Guid.NewGuid(), grant.AccountId, Guid.NewGuid(),
                "Test address", 0m, 0m),
            items.ToList(), items.Sum(x => x.CashRial + x.CreditRial),
            items.Sum(x => x.CashRial), items.Sum(x => x.CreditRial),
            grant.Id, "PAID", "NONE", 1, DateTimeOffset.UtcNow, null, null);

    [Fact]
    public void ScopedCreditPurchasesOmitOtherProgramsAndCashOnlyItems()
    {
        var program = Guid.NewGuid();
        var own = Grant(Guid.NewGuid(), program);
        var other = Grant(Guid.NewGuid(), Guid.NewGuid());
        var ownOrder = Purchase(own,
            Item(500, cash: 200, name: "Funded rice"),
            Item(0, cash: 700, name: "Unrelated cash"));
        var foreignOrder = Purchase(other, Item(900, name: "Foreign grant"));

        var history = Assert.Single(SupporterCreditPurchaseProjection.Compose(
            program, new[] { own, other }, new[] { ownOrder, foreignOrder }));
        Assert.Equal(own.AccountId, history.AccountId);
        Assert.Equal(own.Id, history.GrantId);
        Assert.Equal(2000, history.GrantedRial);
        var item = Assert.Single(history.Purchases);
        Assert.Equal("Funded rice", item.RecordedProductName);
        Assert.Equal(500, item.OriginalCreditRial);
        Assert.Equal(500, item.NetCreditRial);
        Assert.Equal(0, item.RefundedCreditRial);
    }

    [Fact]
    public void CancellationsAndFractionalReturnsPreserveActualNetCredit()
    {
        var own = Grant(Guid.NewGuid(), Guid.NewGuid());
        var cancelled = Purchase(own, Item(800)) with
        {
            State = "CANCELLED", RefundState = "REFUNDED"
        };
        var partial = Purchase(own,
            Item(1001, cash: 2002, quantity: 3, returned: 1)) with { RefundState = "PARTIAL" };
        var items = Assert.Single(SupporterCreditPurchaseProjection.Compose(
            own.ProgramId, new[] { own }, new[] { cancelled, partial })).Purchases;
        Assert.Equal(2, items.Count);
        Assert.Equal(0, items.Single(i => i.OrderId == cancelled.Id).NetCreditRial);
        Assert.Equal(800, items.Single(i => i.OrderId == cancelled.Id).RefundedCreditRial);
        Assert.Equal(333, items.Single(i => i.OrderId == partial.Id).RefundedCreditRial);
        Assert.Equal(668, items.Single(i => i.OrderId == partial.Id).NetCreditRial);
    }

    [Fact]
    public void ExhaustedGrantCashOrdersDoNotCountAsSupporterPurchases()
    {
        var grant = Grant(Guid.NewGuid(), Guid.NewGuid());
        var cashOnly = Purchase(grant, Item(0, cash: 600));
        var row = Assert.Single(SupporterCreditPurchaseProjection.Compose(
            grant.ProgramId, new[] { grant }, new[] { cashOnly }));
        Assert.Equal(2000, row.GrantedRial);
        Assert.Empty(row.Purchases);
    }

    [Fact]
    public void UnlinkedPositiveCreditAndCorruptedCashOrPriceTotalsFailClosed()
    {
        var grant = Grant(Guid.NewGuid(), Guid.NewGuid());
        var order = Purchase(grant, Item(400, cash: 200));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(grant.ProgramId, new[] { grant },
                new[] { order with { CreditGrantId = null } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(grant.ProgramId, new[] { grant },
                new[] { order with { CashPaidRial = 199 } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(grant.ProgramId, new[] { grant },
                new[] { order with { TotalRial = 601 } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(grant.ProgramId, new[] { grant },
                new[] { order with { Items = new List<OrderItem> {
                    order.Items[0] with { UnitPriceRial = 999 } } } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(grant.ProgramId, new[] { grant },
                new[] { order with { State = "CANCELLED" } }));
    }

    [Fact]
    public void InconsistentOwnershipTotalsAndDuplicatesFailClosed()
    {
        var own = Grant(Guid.NewGuid(), Guid.NewGuid());
        var order = Purchase(own, Item(700));
        Assert.Throws<InvalidOperationException>(() =>
            SupporterCreditPurchaseProjection.Compose(own.ProgramId,
                new[] { own }, new[] { order with { BuyerId = Guid.NewGuid() } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(own.ProgramId,
                new[] { own }, new[] { order with { CreditPaidRial = 699 } }));
        Assert.Throws<ArgumentException>(() =>
            SupporterCreditPurchaseProjection.Compose(own.ProgramId,
                new[] { own, own }, new[] { order }));
        Assert.Empty(Assert.Single(SupporterCreditPurchaseProjection.Compose(
            own.ProgramId, new[] { own }, Array.Empty<Order>())).Purchases);
    }
}
