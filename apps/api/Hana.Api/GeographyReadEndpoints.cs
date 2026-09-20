using Hana.Infrastructure.Geography;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// A selectable city is a canonical location, NOT proof that an operational
/// seller, offer, courier or the city launch checklist is ready.
/// </summary>
internal static class GeographyReadEndpoints
{
    internal static void MapGeographyRead(this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/geography")
            .WithTags("Geography");

        routes.MapGet("/provinces", async (IServiceProvider services,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            try
            {
                var db = services.GetRequiredService<HanaGeographyDbContext>();
                var items = await db.Provinces.AsNoTracking()
                    .Where(p => p.State == GeographyStates.Selectable)
                    .OrderBy(p => p.Name).ThenBy(p => p.Id)
                    .Select(p => new { p.Id, p.Name, p.Slug })
                    .ToListAsync(cancellationToken);
                return Results.Ok(new { items });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSelectableProvinces");

        routes.MapGet("/cities", async (IServiceProvider services,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            // Avoid returning the entire country without an explicit scope.
            var query = context.Request.Query;
            if (query.Count != 1 ||
                !query.TryGetValue("provinceId", out var raw) ||
                raw.Count != 1 ||
                !Guid.TryParse(raw[0], out var provinceId) ||
                provinceId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["provinceId"] = ["شناسه استان معتبر و یکتا لازم است."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            try
            {
                var db = services.GetRequiredService<HanaGeographyDbContext>();
                var items = await db.Cities.AsNoTracking()
                    .Where(c => c.ProvinceId == provinceId &&
                        c.State == GeographyStates.Selectable &&
                        c.Province.State == GeographyStates.Selectable)
                    .OrderBy(c => c.Name).ThenBy(c => c.Id)
                    .Select(c => new { c.Id, c.ProvinceId, c.Name, c.Slug })
                    .ToListAsync(cancellationToken);
                return Results.Ok(new { items });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSelectableCities")
        .ProducesValidationProblem();

        routes.MapGet("/cities/{id:guid}", async (Guid id,
            IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (id == Guid.Empty) return Results.NotFound();
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            try
            {
                var db = services.GetRequiredService<HanaGeographyDbContext>();
                var item = await db.Cities.AsNoTracking()
                    .Where(c => c.Id == id &&
                        c.State == GeographyStates.Selectable &&
                        c.Province.State == GeographyStates.Selectable)
                    .Select(c => new { c.Id, c.ProvinceId, c.Name, c.Slug })
                    .SingleOrDefaultAsync(cancellationToken);
                return item is null ? Results.NotFound() : Results.Ok(item);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSelectableCity");
    }
}
