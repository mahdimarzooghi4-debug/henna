using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Public read model for currently published seller offers on a published
/// Catalog good. It never exposes seller account identifiers or drafts.
/// </summary>
internal static class PublicOfferReadEndpoints
{
    internal static void MapPublicOfferReads(this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/catalog/products/{productId:guid}/offers", async (
            Guid productId, IServiceProvider services, HttpContext context,
            [FromQuery] int? page, [FromQuery] int? pageSize,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var number = page ?? 1;
            var size = pageSize ?? 20;
            if (productId == Guid.Empty || number is < 1 or > 10000 ||
                size is < 1 or > 50)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["query"] = ["شناسه کالا یا پارامترهای صفحه‌بندی معتبر نیست."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var catalog = services.GetRequiredService<HanaCatalogDbContext>();
                var product = await catalog.Products.AsNoTracking()
                    .Where(x => x.Id == productId &&
                        x.Kind == CatalogProductKinds.Good &&
                        x.State == PublicationStates.Published &&
                        x.Category.State == PublicationStates.Published &&
                        x.UnitName != null && x.QuantityScale != null)
                    .Select(x => new PublicOfferProduct(x.UnitName!, x.QuantityScale!.Value))
                    .SingleOrDefaultAsync(cancellationToken);
                if (product is null) return Results.NotFound();

                var seller = services.GetRequiredService<HanaSellerDbContext>();
                var offers =
                    from offer in seller.OfferDrafts.AsNoTracking()
                    join application in seller.RegistrationDrafts.AsNoTracking()
                        on offer.SellerAccountId equals application.AccountId
                    where offer.CatalogProductId == productId &&
                        offer.Status == SellerOfferDraftStates.Published &&
                        offer.PriceRials > 0 &&
                        offer.SellableQuantity > 0 &&
                        application.Status == "SUBMITTED" &&
                        application.ReviewStatus == "APPROVED" &&
                        application.ActivatedAtUtc != null &&
                        (application.OfferingType == "GOOD" ||
                            application.OfferingType == "BOTH")
                    orderby application.StoreName, offer.Id
                    select new PublicOfferRow(
                        offer.Id, application.StoreName, offer.PriceRials!.Value,
                        offer.SellableQuantity!.Value, offer.UpdatedAtUtc);

                var total = await offers.CountAsync(cancellationToken);
                var items = await offers.Skip((number - 1) * size)
                    .Take(size)
                    .Select(x => new
                    {
                        id = x.Id,
                        sellerName = x.StoreName,
                        priceRials = x.PriceRials,
                        sellableQuantity = x.SellableQuantity,
                        unitName = product.UnitName,
                        quantityScale = product.QuantityScale,
                        updatedAtUtc = x.UpdatedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new { items, page = number, pageSize = size, total });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetPublishedOffersForCatalogGood")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status404NotFound);
    }

    private sealed record PublicOfferProduct(string UnitName, short QuantityScale);
    private sealed record PublicOfferRow(
        Guid Id, string StoreName, long PriceRials,
        decimal SellableQuantity, DateTimeOffset UpdatedAtUtc);
}
