using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hana.Infrastructure.Buyer;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Persists one editable buyer-side selection. This is not sent to a seller
/// and never represents a quote, order, stock reservation or payment.
/// </summary>
internal static class BuyerPurchaseDraftEndpoints
{
    private const long MaxRevision = 9_007_199_254_740_991L;
    private const int MaxLines = 100;
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    internal static void MapBuyerPurchaseDraft(this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/buyer/cart/purchase-draft")
            .WithTags("Buyer purchase draft");

        routes.MapGet("", async (IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            var accountId = await BuyerReferenceCartEndpoints.ResolveAccount(
                services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            try
            {
                var buyer = services.GetRequiredService<HanaBuyerDbContext>();
                var saved = await buyer.PurchaseDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (saved is null)
                    return Results.Ok(Empty(0));
                if (saved.IsDeleted)
                    return Results.Ok(Empty(saved.Revision));
                var lines = DeserializeLines(saved.LinesJson);
                var current = await ReadCurrentOffers(services, lines,
                    cancellationToken);
                var responseLines = lines.Select(line =>
                {
                    current.TryGetValue(line.OfferId, out var offer);
                    var catalogOk = offer is not null &&
                        offer.ProductId == line.ProductId &&
                        offer.SellerPublicId == saved.SellerPublicId &&
                        offer.UnitName == line.UnitName &&
                        offer.QuantityScale == line.QuantityScale;
                    long? price = catalogOk ? offer!.PriceRials : null;
                    decimal? quantity = catalogOk ? offer!.SellableQuantity : null;
                    return new PurchaseDraftLineResponse(line.ProductId,
                        line.OfferId, line.Quantity, line.UnitName,
                        line.QuantityScale, line.ExpectedPriceRials, price,
                        quantity, price is not null &&
                            price.Value != line.ExpectedPriceRials,
                        catalogOk,
                        catalogOk && quantity >= line.Quantity);
                }).ToArray();
                return Results.Ok(new PurchaseDraftResponse(saved.Revision,
                    saved.SellerPublicId, saved.UpdatedAtUtc, responseLines));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        }).WithName("GetBuyerPurchaseDraft");

        routes.MapPut("", async (IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            var accountId = await BuyerReferenceCartEndpoints.ResolveAccount(
                services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            var request = await ReadJson<SaveBuyerPurchaseDraftRequest>(context.Request,
                cancellationToken);
            if (!TryReadKey(context, out var key) || !Valid(request))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["request"] = ["نسخه، فروشنده، اقلام یا کلید درخواست معتبر نیست."]
                });

            try
            {
                var buyer = services.GetRequiredService<HanaBuyerDbContext>();
                var normalized = Normalize(request!);
                var hash = Hash("PUT", normalized);
                var replay = await ReadReplay(buyer, accountId.Value, key, hash,
                    cancellationToken);
                if (replay is not null) return replay;

                var savedCart = await buyer.ReferenceCarts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (savedCart is null || savedCart.Revision != request!.CartRevision)
                    return Results.Conflict(new { code = "CART_CHANGED" });
                var cartItems = BuyerReferenceCartEndpoints.Deserialize(
                    savedCart.ItemsJson).ToDictionary(x => x.ProductId);
                if (normalized.Lines.Any(line =>
                    !cartItems.ContainsKey(line.ProductId)))
                    return Results.Conflict(new { code = "CART_CHANGED" });

                var current = await ReadCurrentOffers(services, normalized.Lines,
                    cancellationToken);
                if (current.Count != normalized.Lines.Length ||
                    normalized.Lines.Any(line =>
                        !current.TryGetValue(line.OfferId, out var offer) ||
                        offer.SellerPublicId != normalized.SellerPublicId ||
                        offer.ProductId != line.ProductId ||
                        !offer.CatalogEligible ||
                        offer.UnitName != cartItems[line.ProductId].UnitName ||
                        offer.QuantityScale != cartItems[line.ProductId].QuantityScale ||
                        offer.SellableQuantity < cartItems[line.ProductId].Quantity))
                    return Results.Conflict(new { code = "OFFER_UNAVAILABLE" });

                var changed = normalized.Lines.Where(line =>
                    current[line.OfferId].PriceRials != line.ExpectedPriceRials)
                    .Select(line => new
                    {
                        line.ProductId,
                        line.OfferId,
                        currentPriceRials = current[line.OfferId].PriceRials
                    }).ToArray();
                if (changed.Length > 0)
                    return Results.Conflict(new
                    { code = "PRICE_CHANGED", lines = changed });

                var previous = await buyer.PurchaseDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (!normalized.ConfirmCurrentPriceChanges && previous is not null &&
                    !previous.IsDeleted && previous.SellerPublicId == normalized.SellerPublicId)
                {
                    var previousLines = DeserializeLines(previous.LinesJson)
                        .ToDictionary(x => (x.ProductId, x.OfferId));
                    if (normalized.Lines.Any(line =>
                        previousLines.TryGetValue((line.ProductId, line.OfferId), out var old) &&
                        old.ExpectedPriceRials != current[line.OfferId].PriceRials))
                        return Results.Conflict(new { code = "PRICE_CONFIRMATION_REQUIRED" });
                }

                var storedLines = normalized.Lines.Select(line =>
                {
                    var cartLine = cartItems[line.ProductId];
                    return new PurchaseDraftStoredLine(line.ProductId,
                        line.OfferId, cartLine.Quantity, cartLine.UnitName,
                        cartLine.QuantityScale, line.ExpectedPriceRials);
                }).ToArray();
                var now = DateTimeOffset.UtcNow;
                var snapshot = ToResponse(NextRevision(normalized.Revision),
                    normalized.SellerPublicId, now, storedLines, current);
                return await Persist(buyer, accountId.Value, key, hash,
                    normalized.Revision, normalized.SellerPublicId,
                    JsonSerializer.Serialize(storedLines, JsonOptions), false,
                    snapshot, cancellationToken);
            }
            catch (DbUpdateException)
            {
                return await RetryAfterRace(services, accountId.Value, key,
                    Hash("PUT", Normalize(request!)), cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        })
        .WithName("SaveBuyerPurchaseDraft")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status409Conflict);

        routes.MapDelete("", async (IServiceProvider services, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!hasDatabase) return Results.StatusCode(503);
            var accountId = await BuyerReferenceCartEndpoints.ResolveAccount(
                services, context, cancellationToken);
            if (accountId is null) return Results.Unauthorized();
            var request = await ReadJson<DeleteBuyerPurchaseDraftRequest>(context.Request,
                cancellationToken);
            if (!TryReadKey(context, out var key) || request is null ||
                request.Revision < 0 || request.Revision >= MaxRevision)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                { ["revision"] = ["نسخه یا کلید درخواست معتبر نیست."] });
            try
            {
                var buyer = services.GetRequiredService<HanaBuyerDbContext>();
                var hash = Hash("DELETE", request);
                var replay = await ReadReplay(buyer, accountId.Value, key, hash,
                    cancellationToken);
                if (replay is not null) return replay;
                var current = await buyer.PurchaseDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (current is null || current.Revision != request.Revision)
                    return Results.Conflict(new { code = "REVISION_CONFLICT" });
                var snapshot = Empty(request.Revision + 1);
                return await Persist(buyer, accountId.Value, key, hash,
                    request.Revision, Guid.Empty, "[]", true, snapshot,
                    cancellationToken);
            }
            catch (DbUpdateException)
            {
                return await RetryAfterRace(services, accountId.Value, key,
                    Hash("DELETE", request), cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            { return Results.StatusCode(503); }
        }).WithName("DeleteBuyerPurchaseDraft");
    }

    private static async Task<IResult> Persist(HanaBuyerDbContext buyer,
        Guid accountId, Guid key, string hash, long expectedRevision,
        Guid sellerPublicId, string linesJson, bool isDeleted,
        PurchaseDraftResponse response, CancellationToken cancellationToken)
    {
        await using var transaction = await buyer.Database.BeginTransactionAsync(
            cancellationToken);
        var existing = await buyer.PurchaseDrafts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.AccountId == accountId,
                cancellationToken);
        var nextRevision = NextRevision(expectedRevision);
        if (existing is null)
        {
            if (expectedRevision != 0) return Results.Conflict(new { code = "REVISION_CONFLICT" });
            buyer.PurchaseDrafts.Add(new BuyerPurchaseDraftRecord
            {
                AccountId = accountId, Revision = nextRevision,
                SellerPublicId = sellerPublicId, LinesJson = linesJson,
                IsDeleted = isDeleted, UpdatedAtUtc = response.UpdatedAtUtc ?? DateTimeOffset.UtcNow
            });
        }
        else
        {
            if (existing.Revision != expectedRevision)
                return Results.Conflict(new { code = "REVISION_CONFLICT" });
            var updated = await buyer.PurchaseDrafts
                .Where(x => x.AccountId == accountId &&
                    x.Revision == expectedRevision)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Revision, nextRevision)
                    .SetProperty(x => x.SellerPublicId, sellerPublicId)
                    .SetProperty(x => x.LinesJson, linesJson)
                    .SetProperty(x => x.IsDeleted, isDeleted)
                    .SetProperty(x => x.UpdatedAtUtc,
                        response.UpdatedAtUtc ?? DateTimeOffset.UtcNow),
                    cancellationToken);
            if (updated != 1) return Results.Conflict(new { code = "REVISION_CONFLICT" });
        }
        buyer.PurchaseDraftIdempotency.Add(new BuyerPurchaseDraftIdempotencyRecord
        {
            AccountId = accountId, Key = key, RequestSha256 = hash,
            ResponseJson = JsonSerializer.Serialize(response, JsonOptions),
            ResponseStatusCode = StatusCodes.Status200OK,
            CreatedAtUtc = DateTimeOffset.UtcNow
        });
        await buyer.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Json(response, statusCode: StatusCodes.Status200OK);
    }

    private static async Task<IResult?> ReadReplay(HanaBuyerDbContext buyer,
        Guid accountId, Guid key, string hash,
        CancellationToken cancellationToken)
    {
        var receipt = await buyer.PurchaseDraftIdempotency.AsNoTracking()
            .SingleOrDefaultAsync(x => x.AccountId == accountId && x.Key == key,
                cancellationToken);
        if (receipt is null) return null;
        return receipt.RequestSha256 == hash
            ? Results.Content(receipt.ResponseJson, "application/json",
                Encoding.UTF8, receipt.ResponseStatusCode)
            : Results.Conflict(new { code = "IDEMPOTENCY_KEY_REUSED" });
    }

    private static async Task<IResult> RetryAfterRace(IServiceProvider services,
        Guid accountId, Guid key, string hash,
        CancellationToken cancellationToken)
    {
        try
        {
            var buyer = services.GetRequiredService<HanaBuyerDbContext>();
            buyer.ChangeTracker.Clear();
            return await ReadReplay(buyer, accountId, key, hash,
                cancellationToken) ?? Results.Conflict(new { code = "REVISION_CONFLICT" });
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        { return Results.StatusCode(503); }
    }

    private static Task<Dictionary<Guid, CurrentOffer>> ReadCurrentOffers(
        IServiceProvider services,
        IReadOnlyList<PurchaseDraftStoredLine> lines,
        CancellationToken cancellationToken) => ReadCurrentOffers(services,
        lines.Select(line => new PurchaseDraftInputLine(line.ProductId,
            line.OfferId, line.ExpectedPriceRials)).ToArray(),
        cancellationToken);

    private static async Task<Dictionary<Guid, CurrentOffer>> ReadCurrentOffers(
        IServiceProvider services, IReadOnlyList<PurchaseDraftInputLine> lines,
        CancellationToken cancellationToken)
    {
        if (lines.Count == 0) return [];
        var offerIds = lines.Select(x => x.OfferId).ToArray();
        var seller = services.GetRequiredService<HanaSellerDbContext>();
        var rows = await (from offer in seller.OfferDrafts.AsNoTracking()
            join application in seller.RegistrationDrafts.AsNoTracking()
                on offer.SellerAccountId equals application.AccountId
            where offerIds.Contains(offer.Id) &&
                offer.Status == SellerOfferDraftStates.Published &&
                offer.PriceRials > 0 && offer.SellableQuantity > 0 &&
                application.Status == "SUBMITTED" &&
                application.ReviewStatus == "APPROVED" &&
                application.ActivatedAtUtc != null &&
                (application.OfferingType == "GOOD" || application.OfferingType == "BOTH")
            select new CurrentOffer(offer.Id, offer.CatalogProductId,
                application.PublicSellerId, offer.PriceRials!.Value,
                offer.SellableQuantity!.Value, false, null, 0))
            .ToArrayAsync(cancellationToken);
        if (rows.Length == 0) return [];
        var productIds = rows.Select(x => x.ProductId).Distinct().ToArray();
        var catalog = services.GetRequiredService<HanaCatalogDbContext>();
        var eligible = await catalog.Products.AsNoTracking()
            .Where(x => productIds.Contains(x.Id) &&
                x.Kind == CatalogProductKinds.Good &&
                x.State == PublicationStates.Published &&
                x.Category.State == PublicationStates.Published &&
                x.UnitName != null && x.QuantityScale != null)
            .Select(x => new { x.Id, x.UnitName, x.QuantityScale })
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        return rows.ToDictionary(row => row.OfferId, row =>
        {
            var ok = eligible.TryGetValue(row.ProductId, out var product);
            return row with
            {
                CatalogEligible = ok,
                UnitName = ok ? product!.UnitName! : null,
                QuantityScale = ok ? product!.QuantityScale!.Value : 0
            };
        });
    }

    private static PurchaseDraftResponse ToResponse(long revision,
        Guid sellerPublicId, DateTimeOffset updatedAtUtc,
        IReadOnlyList<PurchaseDraftStoredLine> lines,
        IReadOnlyDictionary<Guid, CurrentOffer> current) =>
        new(revision, sellerPublicId, updatedAtUtc,
            lines.Select(line =>
            {
                current.TryGetValue(line.OfferId, out var offer);
                var usable = offer is not null && offer.CatalogEligible &&
                    offer.ProductId == line.ProductId &&
                    offer.SellerPublicId == sellerPublicId &&
                    offer.UnitName == line.UnitName &&
                    offer.QuantityScale == line.QuantityScale;
                return new PurchaseDraftLineResponse(line.ProductId,
                    line.OfferId, line.Quantity, line.UnitName,
                    line.QuantityScale, line.ExpectedPriceRials,
                    usable ? offer!.PriceRials : null,
                    usable ? offer!.SellableQuantity : null,
                    usable && offer!.PriceRials != line.ExpectedPriceRials,
                    usable, usable && offer!.SellableQuantity >= line.Quantity);
            }).ToArray());

    private static PurchaseDraftResponse Empty(long revision) =>
        new(revision, null, null, []);

    private static IReadOnlyList<PurchaseDraftStoredLine> DeserializeLines(string json) =>
        JsonSerializer.Deserialize<PurchaseDraftStoredLine[]>(json, JsonOptions) ?? [];

    private static bool TryReadKey(HttpContext context, out Guid key) =>
        Guid.TryParse(context.Request.Headers["Idempotency-Key"].ToString(), out key) &&
        key != Guid.Empty;

    private static async Task<T?> ReadJson<T>(HttpRequest request,
        CancellationToken cancellationToken)
    {
        try
        { return await request.ReadFromJsonAsync<T>(JsonOptions, cancellationToken); }
        catch (JsonException)
        { return default; }
    }

    private static bool Valid(SaveBuyerPurchaseDraftRequest? request) =>
        request is not null && request.Revision >= 0 && request.Revision < MaxRevision &&
        request.CartRevision >= 0 && request.CartRevision < MaxRevision &&
        request.SellerPublicId != Guid.Empty && request.Lines is { Length: > 0 and <= MaxLines } &&
        request.Lines.All(x => x.ProductId != Guid.Empty && x.OfferId != Guid.Empty &&
            x.ExpectedPriceRials > 0) &&
        request.Lines.Select(x => x.ProductId).Distinct().Count() == request.Lines.Length &&
        request.Lines.Select(x => x.OfferId).Distinct().Count() == request.Lines.Length;

    private static SaveBuyerPurchaseDraftRequest Normalize(
        SaveBuyerPurchaseDraftRequest request) => request with
        {
            Lines = request.Lines.OrderBy(x => x.ProductId).ThenBy(x => x.OfferId).ToArray()
        };

    private static long NextRevision(long revision) => revision + 1;

    private static string Hash<T>(string operation, T request) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(
            new { operation, request }, JsonOptions))).ToLowerInvariant();

    private sealed record CurrentOffer(Guid OfferId, Guid ProductId,
        Guid SellerPublicId, long PriceRials, decimal SellableQuantity,
        bool CatalogEligible, string? UnitName, int QuantityScale);
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
internal sealed record SaveBuyerPurchaseDraftRequest(long Revision,
    long CartRevision, Guid SellerPublicId, bool ConfirmCurrentPriceChanges,
    PurchaseDraftInputLine[] Lines);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
internal sealed record PurchaseDraftInputLine(Guid ProductId, Guid OfferId,
    long ExpectedPriceRials);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
internal sealed record DeleteBuyerPurchaseDraftRequest(long Revision);
internal sealed record PurchaseDraftStoredLine(Guid ProductId, Guid OfferId,
    decimal Quantity, string UnitName, int QuantityScale,
    long ExpectedPriceRials);
internal sealed record PurchaseDraftResponse(long Revision, Guid? SellerPublicId,
    DateTimeOffset? UpdatedAtUtc, IReadOnlyList<PurchaseDraftLineResponse> Lines);
internal sealed record PurchaseDraftLineResponse(Guid ProductId, Guid OfferId,
    decimal Quantity, string UnitName, int QuantityScale,
    long ExpectedPriceRials, long? CurrentPriceRials,
    decimal? CurrentSellableQuantity, bool PriceChanged, bool OfferAvailable,
    bool CoversRequestedQuantity);
