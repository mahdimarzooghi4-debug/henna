using Hana.Infrastructure.Buyer;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Read-only comparison of current published offers against one buyer's
/// reference cart. This endpoint never creates a quote, order or reservation.
/// </summary>
internal static class BuyerCartOfferComparisonEndpoints
{
    private const int MaxOffersPerComparison = 2000;

    internal static void MapBuyerCartOfferComparison(
        this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/buyer/cart/offers", async (
            IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            var accountId = await BuyerReferenceCartEndpoints.ResolveAccount(
                services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();

            try
            {
                var buyer = services.GetRequiredService<HanaBuyerDbContext>();
                var cart = await buyer.ReferenceCarts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (cart is null)
                    return Results.Ok(new BuyerCartOfferComparisonResponse(
                        0, [], []));

                var cartItems = BuyerReferenceCartEndpoints.Deserialize(
                    cart.ItemsJson);
                if (cartItems.Count == 0)
                    return Results.Ok(new BuyerCartOfferComparisonResponse(
                        cart.Revision, [], []));

                var productIds = cartItems.Select(x => x.ProductId).Distinct().ToArray();
                var catalog = services.GetRequiredService<HanaCatalogDbContext>();
                var products = await catalog.Products.AsNoTracking()
                    .Where(x => productIds.Contains(x.Id) &&
                        x.Kind == CatalogProductKinds.Good &&
                        x.State == PublicationStates.Published &&
                        x.Category.State == PublicationStates.Published &&
                        x.UnitName != null && x.QuantityScale != null)
                    .Select(x => new ComparisonCatalogProduct(
                        x.Id, x.UnitName!, x.QuantityScale!.Value))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

                var cartItemById = cartItems.ToDictionary(x => x.ProductId);
                var eligibleItems = cartItems.Where(item =>
                    products.TryGetValue(item.ProductId, out var product) &&
                    string.Equals(product.UnitName, item.UnitName,
                        StringComparison.Ordinal) &&
                    product.QuantityScale == item.QuantityScale)
                    .ToArray();
                var eligibleProductIds = eligibleItems
                    .Select(x => x.ProductId).ToArray();

                var offerRows = Array.Empty<ComparisonOfferRow>();
                if (eligibleProductIds.Length > 0)
                {
                    var seller = services.GetRequiredService<HanaSellerDbContext>();
                    offerRows = await (
                        from offer in seller.OfferDrafts.AsNoTracking()
                        join application in seller.RegistrationDrafts.AsNoTracking()
                            on offer.SellerAccountId equals application.AccountId
                        where eligibleProductIds.Contains(offer.CatalogProductId) &&
                            offer.Status == SellerOfferDraftStates.Published &&
                            offer.PriceRials > 0 &&
                            offer.SellableQuantity > 0 &&
                            application.Status == "SUBMITTED" &&
                            application.ReviewStatus == "APPROVED" &&
                            application.ActivatedAtUtc != null &&
                            (application.OfferingType == "GOOD" ||
                                application.OfferingType == "BOTH")
                        orderby application.StoreName,
                            application.PublicSellerId, offer.Id
                        select new ComparisonOfferRow(
                            offer.Id, application.PublicSellerId,
                            application.StoreName, offer.CatalogProductId,
                            offer.PriceRials!.Value,
                            offer.SellableQuantity!.Value, offer.UpdatedAtUtc))
                        .Take(MaxOffersPerComparison + 1)
                        .ToArrayAsync(cancellationToken);

                    // Do not return a silently truncated comparison. The UI
                    // will show unavailable and can retry or use item detail.
                    if (offerRows.Length > MaxOffersPerComparison)
                        return Results.StatusCode(
                            StatusCodes.Status503ServiceUnavailable);
                }

                var offersByProduct = offerRows
                    .GroupBy(x => x.ProductId)
                    .ToDictionary(x => x.Key, x => x.ToArray());
                var comparisonItems = cartItems.Select(item =>
                {
                    var status = !products.TryGetValue(item.ProductId,
                            out var product)
                        ? "CATALOG_UNAVAILABLE"
                        : product.UnitName != item.UnitName ||
                            product.QuantityScale != item.QuantityScale
                            ? "CATALOG_CHANGED"
                            : offersByProduct.ContainsKey(item.ProductId)
                                ? "HAS_PUBLISHED_OFFERS"
                                : "NO_PUBLISHED_OFFERS";
                    return new BuyerCartOfferComparisonItem(
                        item.ProductId, item.Quantity, item.UnitName,
                        item.QuantityScale, status);
                }).ToArray();

                var sellers = offerRows
                    .GroupBy(x => new { x.SellerPublicId, x.SellerName })
                    .Select(group => new BuyerCartOfferComparisonSeller(
                        group.Key.SellerPublicId, group.Key.SellerName,
                        group.Select(offer =>
                        {
                            var requested = cartItemById[offer.ProductId];
                            var product = products[offer.ProductId];
                            return new BuyerCartOfferComparisonLine(
                                offer.ProductId, offer.OfferId,
                                offer.PriceRials, offer.SellableQuantity,
                                requested.Quantity, product.UnitName,
                                product.QuantityScale,
                                offer.SellableQuantity >= requested.Quantity,
                                offer.UpdatedAtUtc);
                        }).ToArray()))
                    .ToArray();

                return Results.Ok(new BuyerCartOfferComparisonResponse(
                    cart.Revision, comparisonItems, sellers));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetBuyerCartOfferComparison");
    }

    private sealed record ComparisonCatalogProduct(
        Guid Id, string UnitName, short QuantityScale);
    private sealed record ComparisonOfferRow(
        Guid OfferId, Guid SellerPublicId, string SellerName, Guid ProductId,
        long PriceRials, decimal SellableQuantity,
        DateTimeOffset UpdatedAtUtc);
}

internal sealed record BuyerCartOfferComparisonResponse(
    long CartRevision,
    IReadOnlyList<BuyerCartOfferComparisonItem> Items,
    IReadOnlyList<BuyerCartOfferComparisonSeller> Sellers);
internal sealed record BuyerCartOfferComparisonItem(
    Guid ProductId, decimal RequestedQuantity, string UnitName,
    int QuantityScale, string Status);
internal sealed record BuyerCartOfferComparisonSeller(
    Guid SellerPublicId, string SellerName,
    IReadOnlyList<BuyerCartOfferComparisonLine> Offers);
internal sealed record BuyerCartOfferComparisonLine(
    Guid ProductId, Guid OfferId, long PriceRials,
    decimal SellableQuantity, decimal RequestedQuantity, string UnitName,
    int QuantityScale, bool CoversRequestedQuantity,
    DateTimeOffset UpdatedAtUtc);
