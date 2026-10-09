namespace Hana.Infrastructure.Commerce;

/// <summary>
/// INTERNAL-ONLY factual credit/grant history projection. Does not authorize
/// funding supporters and MUST NOT be exposed by any endpoint until an
/// independently approved funding supporter -> program access contract exists.
/// </summary>
public static class SupporterCreditPurchaseProjection
{
    public sealed record PurchaseLine(
        Guid OrderId, DateTimeOffset PurchasedAtUtc, string OrderState,
        string RefundState, Guid ProductId, string? RecordedProductName,
        int Quantity, int RefundedQuantity, long OriginalCreditRial,
        long RefundedCreditRial, long NetCreditRial);

    public sealed record Beneficiary(
        Guid GrantId, Guid AccountId, Guid ProgramId, long GrantedRial,
        IReadOnlyList<PurchaseLine> Purchases);

    /// <remarks>
    /// No authorization takes place in this function. Callers MUST verify
    /// authenticated funder-to-program scope against server persistence
    /// before supplying any programId, grants or orders.
    /// </remarks>
    public static IReadOnlyList<Beneficiary> Compose(
        Guid programId, IReadOnlyCollection<CreditGrant> grants,
        IReadOnlyCollection<Order> orders)
    {
        if (programId == Guid.Empty) throw new ArgumentException(
            "An authorized program ID is required.", nameof(programId));
        ArgumentNullException.ThrowIfNull(grants);
        ArgumentNullException.ThrowIfNull(orders);
        if (grants.Any(g => g.Id == Guid.Empty || g.AccountId == Guid.Empty ||
                g.ProgramId == Guid.Empty || g.GrantedRial < 0 ||
                g.AvailableRial < 0 || g.AvailableRial > g.GrantedRial) ||
            grants.Select(g => g.Id).Distinct().Count() != grants.Count)
            throw new ArgumentException("Invalid or duplicate credit grants.", nameof(grants));
        if (orders.Any(o => o.Id == Guid.Empty || o.BuyerId == Guid.Empty ||
                o.TotalRial < 0 || o.CreditPaidRial < 0 || o.CashPaidRial < 0 ||
                (decimal)o.CreditPaidRial + o.CashPaidRial != o.TotalRial ||
                (o.CreditPaidRial > 0 && !o.CreditGrantId.HasValue) ||
                (o.State == "CANCELLED" && o.RefundState != "REFUNDED") ||
                o.Items is null || o.Items.Any(i => i.Id == Guid.Empty ||
                    i.ProductId == Guid.Empty || i.UnitPriceRial <= 0 ||
                    i.Quantity <= 0 || i.RefundedQuantity < 0 ||
                    i.RefundedQuantity > i.Quantity ||
                    i.CreditRial < 0 || i.CashRial < 0 ||
                    (decimal)i.CreditRial + i.CashRial !=
                        (decimal)i.UnitPriceRial * i.Quantity) ||
                o.Items.Select(i => i.Id).Distinct().Count() != o.Items.Count ||
                o.Items.Sum(i => (decimal)i.CreditRial) != o.CreditPaidRial ||
                o.Items.Sum(i => (decimal)i.CashRial) != o.CashPaidRial) ||
            orders.Select(o => o.Id).Distinct().Count() != orders.Count)
            throw new ArgumentException("Inconsistent recorded order credit lineage.", nameof(orders));

        var grantsById = grants.ToDictionary(g => g.Id);
        foreach (var order in orders.Where(o => o.CreditGrantId.HasValue))
            if (grantsById.TryGetValue(order.CreditGrantId!.Value, out var grant) &&
                order.BuyerId != grant.AccountId)
                throw new InvalidOperationException(
                    "Order credit grant belongs to a different account.");

        return grants.Where(g => g.ProgramId == programId)
            .OrderBy(g => g.AccountId).ThenBy(g => g.Id)
            .Select(g =>
            {
                var lines = orders.Where(o =>
                        o.CreditGrantId == g.Id && o.BuyerId == g.AccountId)
                    .OrderBy(o => o.CreatedAtUtc).ThenBy(o => o.Id)
                    .SelectMany(o => o.Items.Where(i => i.CreditRial > 0)
                        .OrderBy(i => i.Id).Select(i =>
                        {
                            // CommerceService.Refund uses exact cumulative floor
                            // differences for partial credit returns.
                            var refunded = o.State == "CANCELLED"
                                ? i.CreditRial : checked((long)decimal.Floor(
                                    (decimal)i.CreditRial * i.RefundedQuantity /
                                    i.Quantity));
                            return new PurchaseLine(o.Id, o.CreatedAtUtc,
                                o.State, o.RefundState, i.ProductId,
                                string.IsNullOrWhiteSpace(i.ProductName)
                                    ? null : i.ProductName,
                                i.Quantity, i.RefundedQuantity, i.CreditRial,
                                refunded, checked(i.CreditRial - refunded));
                        }))
                    .ToArray();
                return new Beneficiary(g.Id, g.AccountId, g.ProgramId,
                    g.GrantedRial, lines);
            }).ToArray();
    }
}
