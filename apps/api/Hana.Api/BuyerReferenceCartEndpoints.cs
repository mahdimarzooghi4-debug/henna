using System.Text.Json;
using Hana.Infrastructure.Buyer;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Account-scoped reference list only. Values here never imply price,
/// availability, seller selection, reservation, order, or payment.
/// </summary>
internal static class BuyerReferenceCartEndpoints
{
    private const int MaxItems = 100;
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    internal static void MapBuyerReferenceCart(this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/buyer/cart").WithTags("Buyer cart");
        routes.MapGet("", async (IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            var accountId = await ResolveAccount(services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            try
            {
                var db = services.GetRequiredService<HanaBuyerDbContext>();
                var cart = await db.ReferenceCarts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId, cancellationToken);
                return Results.Ok(cart is null
                    ? new BuyerCartResponse(0, [])
                    : new BuyerCartResponse(cart.Revision, Deserialize(cart.ItemsJson)));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        }).WithName("GetBuyerReferenceCart");

        routes.MapPut("/items/{productId:guid}", async (Guid productId,
            SetBuyerCartItemRequest? request, IServiceProvider services,
            HttpContext context, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            if (productId == Guid.Empty || request is null || request.Revision < 0 ||
                request.Revision >= 9_007_199_254_740_991L ||
                request.Quantity <= 0 || request.Quantity > 1_000_000_000_000m)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                { ["item"] = ["شناسه، مقدار یا نسخهٔ سبد معتبر نیست."] });
            var accountId = await ResolveAccount(services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            var canonicalUnit = "";
            var canonicalScale = 0;
            try
            {
                var catalog = services.GetRequiredService<HanaCatalogDbContext>();
                var product = await catalog.Products.AsNoTracking()
                    .Where(x => x.Id == productId && x.Kind == CatalogProductKinds.Good &&
                        x.State == PublicationStates.Published &&
                        x.Category.State == PublicationStates.Published &&
                        x.UnitName != null && x.QuantityScale != null)
                    .Select(x => new { x.UnitName, x.QuantityScale })
                    .SingleOrDefaultAsync(cancellationToken);
                if (product is null) return Results.NotFound();
                canonicalUnit = product.UnitName!;
                canonicalScale = product.QuantityScale!.Value;
                if (!FitsScale(request.Quantity, product.QuantityScale!.Value))
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["quantity"] = ["دقت مقدار با واحد رسمی کاتالوگ سازگار نیست."] });

                var db = services.GetRequiredService<HanaBuyerDbContext>();
                var current = await db.ReferenceCarts.SingleOrDefaultAsync(
                    x => x.AccountId == accountId, cancellationToken);
                var items = current is null ? [] : Deserialize(current.ItemsJson).ToList();
                var index = items.FindIndex(x => x.ProductId == productId);
                var nextItem = new BuyerCartItemResponse(productId, request.Quantity,
                    product.UnitName!, product.QuantityScale.Value);
                if (index >= 0) items[index] = nextItem;
                else
                {
                    if (items.Count >= MaxItems)
                        return Results.Conflict(new { message = "سبد به سقف تعداد کالا رسیده است." });
                    items.Add(nextItem);
                }

                var now = DateTimeOffset.UtcNow;
                var json = JsonSerializer.Serialize(items, JsonOptions);
                if (current is null)
                {
                    if (request.Revision != 0) return RevisionConflict();
                    db.ReferenceCarts.Add(new BuyerReferenceCartRecord
                    {
                        AccountId = accountId.Value, Revision = 1,
                        ItemsJson = json, UpdatedAtUtc = now
                    });
                    await db.SaveChangesAsync(cancellationToken);
                    return Results.Ok(new BuyerCartResponse(1, items));
                }
                if (current.Revision != request.Revision)
                    return await ReplayIfAlreadySet(db, accountId.Value, productId,
                        request.Quantity, product.UnitName!, product.QuantityScale.Value,
                        cancellationToken) ?? RevisionConflict();
                if (current.Revision >= 9_007_199_254_740_991L) return RevisionConflict();
                var updated = await db.ReferenceCarts
                    .Where(x => x.AccountId == accountId && x.Revision == request.Revision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.Revision, request.Revision + 1)
                        .SetProperty(x => x.ItemsJson, json)
                        .SetProperty(x => x.UpdatedAtUtc, now), cancellationToken);
                return updated == 1
                    ? Results.Ok(new BuyerCartResponse(request.Revision + 1, items))
                    : await ReplayIfAlreadySet(db, accountId.Value, productId,
                        request.Quantity, product.UnitName!, product.QuantityScale.Value,
                        cancellationToken) ?? RevisionConflict();
            }
            catch (DbUpdateException)
            {
                var replay = await ReplayIfAlreadySet(
                    services.GetRequiredService<HanaBuyerDbContext>(), accountId.Value,
                    productId, request.Quantity, canonicalUnit, canonicalScale,
                    cancellationToken);
                return replay ?? RevisionConflict();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        }).WithName("SetBuyerReferenceCartItem");

        routes.MapDelete("/items/{productId:guid}", async (Guid productId,
            long? revision, IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            if (productId == Guid.Empty || revision is null or < 0 ||
                revision >= 9_007_199_254_740_991L)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                { ["revision"] = ["نسخهٔ سبد معتبر نیست."] });
            var accountId = await ResolveAccount(services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            try
            {
                var db = services.GetRequiredService<HanaBuyerDbContext>();
                var current = await db.ReferenceCarts.SingleOrDefaultAsync(
                    x => x.AccountId == accountId, cancellationToken);
                if (current is null)
                    return revision == 0
                        ? Results.Ok(new BuyerCartResponse(0, []))
                        : RevisionConflict();
                var currentItems = Deserialize(current.ItemsJson);
                if (current.Revision != revision)
                    return currentItems.Any(x => x.ProductId == productId)
                        ? RevisionConflict()
                        : Results.Ok(new BuyerCartResponse(current.Revision, currentItems));
                var items = currentItems
                    .Where(x => x.ProductId != productId).ToArray();
                if (items.Length == currentItems.Count)
                    return Results.Ok(new BuyerCartResponse(current.Revision, items));
                if (current.Revision >= 9_007_199_254_740_991L) return RevisionConflict();
                var nextRevision = current.Revision + 1;
                var json = JsonSerializer.Serialize(items, JsonOptions);
                var updated = await db.ReferenceCarts
                    .Where(x => x.AccountId == accountId && x.Revision == revision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.Revision, nextRevision)
                        .SetProperty(x => x.ItemsJson, json)
                        .SetProperty(x => x.UpdatedAtUtc, DateTimeOffset.UtcNow), cancellationToken);
                return updated == 1 ? Results.Ok(new BuyerCartResponse(nextRevision, items)) : RevisionConflict();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        }).WithName("RemoveBuyerReferenceCartItem");
    }

    private static async Task<Guid?> ResolveAccount(IServiceProvider services,
        HttpContext context, CancellationToken cancellationToken)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ||
            authorization.Length <= 7) return null;
        return await services.GetRequiredService<AuthSessionService>()
            .ResolveAccountAsync(authorization[7..].Trim(), cancellationToken);
    }

    private static bool FitsScale(decimal quantity, int scale)
    {
        var factor = (decimal)Math.Pow(10, scale);
        return quantity * factor == decimal.Truncate(quantity * factor);
    }

    private static async Task<IResult?> ReplayIfAlreadySet(HanaBuyerDbContext db,
        Guid accountId, Guid productId, decimal quantity, string unitName,
        int quantityScale, CancellationToken cancellationToken)
    {
        var current = await db.ReferenceCarts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.AccountId == accountId, cancellationToken);
        if (current is null) return null;
        var items = Deserialize(current.ItemsJson);
        var matching = items.SingleOrDefault(x => x.ProductId == productId);
        if (matching is null || matching.Quantity != quantity ||
            (unitName.Length > 0 && (matching.UnitName != unitName ||
                matching.QuantityScale != quantityScale))) return null;
        return Results.Ok(new BuyerCartResponse(current.Revision, items));
    }

    private static IReadOnlyList<BuyerCartItemResponse> Deserialize(string json) =>
        JsonSerializer.Deserialize<List<BuyerCartItemResponse>>(json, JsonOptions) ?? [];

    private static IResult RevisionConflict() => Results.Conflict(new
    { message = "سبد تغییر کرده است؛ آن را دوباره دریافت و تلاش کنید." });

}

internal sealed record SetBuyerCartItemRequest(long Revision, decimal Quantity);
internal sealed record BuyerCartItemResponse(Guid ProductId, decimal Quantity,
    string UnitName, int QuantityScale);
internal sealed record BuyerCartResponse(long Revision,
    IReadOnlyList<BuyerCartItemResponse> Items);
