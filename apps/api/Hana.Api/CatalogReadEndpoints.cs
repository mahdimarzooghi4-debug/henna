using Hana.Infrastructure.Catalog;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Read-only catalog identities. A published product is not an offer:
/// no price, seller, stock, delivery coverage or purchase eligibility exists.
/// </summary>
internal static class CatalogReadEndpoints
{
    internal static void MapCatalogRead(this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/catalog").WithTags("Catalog");

        routes.MapGet("/categories", async (IServiceProvider services,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var db = services.GetRequiredService<HanaCatalogDbContext>();
                var items = await db.Categories.AsNoTracking()
                    .Where(c => c.State == PublicationStates.Published)
                    .OrderBy(c => c.Name).ThenBy(c => c.Id)
                    .Select(c => new { c.Id, c.Name, c.Slug })
                    .ToListAsync(cancellationToken);
                return Results.Ok(new { items });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetPublishedCatalogCategories");

        routes.MapGet("/products", async (
            IServiceProvider services, HttpContext context,
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
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var db = services.GetRequiredService<HanaCatalogDbContext>();
                var query = db.Products.AsNoTracking()
                    .Where(p => p.State == PublicationStates.Published &&
                        p.Category.State == PublicationStates.Published);
                if (categoryId is { } id)
                    query = query.Where(p => p.CategoryId == id);

                var term = search?.Trim();
                if (!string.IsNullOrWhiteSpace(term))
                {
                    // Escape SQL LIKE wildcards, so a literal "%" does not
                    // match every product. Queries remain parameterized.
                    var pattern = "%" + term.Replace("\\", "\\\\")
                        .Replace("%", "\\%").Replace("_", "\\_") + "%";
                    query = query.Where(p =>
                        EF.Functions.ILike(p.Name, pattern, "\\"));
                }

                var total = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderBy(p => p.Name).ThenBy(p => p.Id)
                    .Skip((number - 1) * size).Take(size)
                    .Select(p => new
                    {
                        p.Id, p.CategoryId, p.Name, p.Kind, p.Description
                    })
                    .ToListAsync(cancellationToken);
                return Results.Ok(new
                {
                    items, page = number, pageSize = size, total
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetPublishedCatalogProducts")
        .ProducesValidationProblem();

        routes.MapGet("/products/{id:guid}", async (
            Guid id, IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (id == Guid.Empty) return Results.NotFound();
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var db = services.GetRequiredService<HanaCatalogDbContext>();
                var item = await db.Products.AsNoTracking()
                    .Where(p => p.Id == id &&
                        p.State == PublicationStates.Published &&
                        p.Category.State == PublicationStates.Published)
                    .Select(p => new
                    {
                        p.Id, p.CategoryId, p.Name, p.Kind, p.Description
                    })
                    .SingleOrDefaultAsync(cancellationToken);
                return item is null ? Results.NotFound() : Results.Ok(item);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetPublishedCatalogProduct");
    }
}
