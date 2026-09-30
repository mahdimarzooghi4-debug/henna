using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerCatalogGoodsEndpoints
{
    internal static void MapSellerCatalogGoods(
        this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/seller/catalog/goods", async (
            HttpContext context, IServiceProvider services,
            [FromQuery] int? page, [FromQuery] int? pageSize,
            [FromQuery] Guid? categoryId, [FromQuery] string? search,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var number = page ?? 1;
            var size = pageSize ?? 20;
            if (number is < 1 or > 10000 || size is < 1 or > 50 ||
                categoryId == Guid.Empty ||
                (search is not null && search.Trim().Length > 80))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["query"] = ["پارامترهای جست‌وجو یا صفحه‌بندی معتبر نیست."]
                });

            SellerOfferDraftEndpoints.SellerGate gate;
            try
            {
                gate = await SellerOfferDraftEndpoints.ResolveSellerAsync(
                    app, context, services, hasDatabase, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
            if (gate.RejectionStatus is { } status)
                return Results.StatusCode(status);

            try
            {
                var db = services.GetRequiredService<HanaCatalogDbContext>();
                var eligibleGoods = db.Products.AsNoTracking()
                    .Where(product =>
                        product.Kind == CatalogProductKinds.Good &&
                        product.State == PublicationStates.Published &&
                        product.Category.State == PublicationStates.Published);

                // The filter choices must themselves be categories that contain
                // at least one currently eligible supermarket good.
                var categoryRows = await eligibleGoods
                    .Select(product => new
                    {
                        product.CategoryId,
                        Name = product.Category.Name,
                        Slug = product.Category.Slug
                    })
                    .Distinct()
                    .OrderBy(category => category.Name)
                    .ThenBy(category => category.CategoryId)
                    .ToListAsync(cancellationToken);
                var categories = categoryRows.Select(category =>
                    new SellerCatalogCategoryRow(
                        category.CategoryId, category.Name, category.Slug))
                    .ToList();

                var query = eligibleGoods;
                if (categoryId is { } selectedCategory)
                    query = query.Where(product =>
                        product.CategoryId == selectedCategory);

                var term = search?.Trim();
                if (!string.IsNullOrWhiteSpace(term))
                {
                    var pattern = "%" + term.Replace("\\", "\\\\")
                        .Replace("%", "\\%").Replace("_", "\\_") + "%";
                    query = query.Where(product =>
                        EF.Functions.ILike(product.Name, pattern, "\\"));
                }

                var total = await query.CountAsync(cancellationToken);
                var rows = await query
                    .OrderBy(product => product.Name)
                    .ThenBy(product => product.Id)
                    .Skip((number - 1) * size)
                    .Take(size)
                    .Select(product => new SellerCatalogGoodRow(
                        product.Id,
                        product.CategoryId,
                        product.Name,
                        product.Category.Name,
                        product.Description,
                        product.PrimaryMediaAssetId))
                    .ToListAsync(cancellationToken);

                var items = rows.Select(product =>
                    new SellerCatalogGoodResponse(
                        product.Id,
                        product.CategoryId,
                        product.Name,
                        product.CategoryName,
                        product.Description,
                        product.PrimaryMediaAssetId is { } mediaId
                            ? $"/api/v1/catalog/media/{mediaId:D}"
                            : null))
                    .ToList();

                return Results.Ok(new
                {
                    items,
                    categories,
                    page = number,
                    pageSize = size,
                    total
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSellerCatalogGoods")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}

internal sealed record SellerCatalogCategoryRow(Guid Id, string Name, string Slug);

internal sealed record SellerCatalogGoodRow(
    Guid Id,
    Guid CategoryId,
    string Name,
    string CategoryName,
    string? Description,
    Guid? PrimaryMediaAssetId);

internal sealed record SellerCatalogGoodResponse(
    Guid Id,
    Guid CategoryId,
    string Name,
    string CategoryName,
    string? Description,
    string? ImageUrl);
