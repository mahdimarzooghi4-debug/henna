using System.Security.Cryptography;
using System.Text;
using Hana.Application.Time;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerOfferLifecycleEndpoints
{
    internal static void MapSellerOfferLifecycle(
        this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/offers/{offerId:guid}")
            .WithTags("Seller Offers");

        routes.MapPut("", UpdateAsync)
            .WithName("UpdateSellerOffer")
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status409Conflict);

        routes.MapPost("/publish", PublishAsync)
            .WithName("PublishSellerOffer")
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status409Conflict);

        async Task<IResult> UpdateAsync(
            Guid offerId, UpdateSellerOfferRequest? request,
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken)
        {
            context.Response.Headers.CacheControl = "no-store";
            var gate = await ResolveGate(app, context, services, hasDatabase,
                cancellationToken);
            if (gate.RejectionStatus is { } denied)
                return Results.StatusCode(denied);
            if (request is null || offerId == Guid.Empty ||
                request.ExpectedRevision < 1 ||
                request.ExpectedRevision == int.MaxValue ||
                request.PriceRials < 1 || request.PriceRials > 9_007_199_254_740_991L ||
                request.SellableQuantity < 0 ||
                request.SellableQuantity > 999_999_999_999m)
                return ValidationError();
            if (!TryGetIdempotencyKey(context, out var key))
                return ValidationError("Idempotency-Key");

            var digest = Hash(FormattableString.Invariant(
                $"UPDATE|{offerId:D}|{request.ExpectedRevision}|{request.PriceRials}|{request.SellableQuantity}"));
            var db = services.GetRequiredService<HanaSellerDbContext>();
            try
            {
                await using var transaction = await db.Database
                    .BeginTransactionAsync(cancellationToken);
                var replay = await FindReplay(db, gate.AccountId!.Value,
                    key, digest, offerId, cancellationToken);
                if (replay is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return replay.Value.Result is { } result
                        ? Results.Ok(result) : Results.Conflict();
                }

                var current = await db.OfferDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == offerId &&
                        x.SellerAccountId == gate.AccountId.Value,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                if (current.Revision != request.ExpectedRevision)
                    return Results.Conflict();
                if (current.Status is not (SellerOfferDraftStates.Draft or
                    SellerOfferDraftStates.Published or SellerOfferDraftStates.Paused))
                    return Results.Conflict();

                var product = await EligibleProduct(services, current.CatalogProductId,
                    cancellationToken);
                if (product is null || !FitsScale(request.SellableQuantity,
                    product.QuantityScale))
                    return Results.Conflict();

                var now = services.GetRequiredService<IClock>()
                    .UtcNow.ToUniversalTime();
                var nextRevision = request.ExpectedRevision + 1;
                var changed = await db.OfferDrafts
                    .Where(x => x.Id == offerId &&
                        x.SellerAccountId == gate.AccountId.Value &&
                        x.Revision == request.ExpectedRevision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.PriceRials, request.PriceRials)
                        .SetProperty(x => x.SellableQuantity, request.SellableQuantity)
                        .SetProperty(x => x.Status, SellerOfferDraftStates.Draft)
                        .SetProperty(x => x.Revision, nextRevision)
                        .SetProperty(x => x.UpdatedAtUtc, now), cancellationToken);
                if (changed != 1) return Results.Conflict();

                db.OfferMutations.Add(new SellerOfferMutationRecord
                {
                    Id = Guid.NewGuid(), OfferId = offerId,
                    SellerAccountId = gate.AccountId.Value,
                    ExpectedRevision = request.ExpectedRevision,
                    ResultingRevision = nextRevision,
                    Action = SellerOfferMutationActions.Updated,
                    ResultingStatus = SellerOfferDraftStates.Draft,
                    IdempotencyKey = key, RequestSha256 = digest,
                    PriceRials = request.PriceRials,
                    SellableQuantity = request.SellableQuantity,
                    CreatedAtUtc = now
                });
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Results.Ok(ToResponse(current, nextRevision,
                    SellerOfferDraftStates.Draft, request.PriceRials,
                    request.SellableQuantity, now));
            }
            catch (DbUpdateException)
            {
                return Results.Conflict();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        }

        async Task<IResult> PublishAsync(
            Guid offerId, PublishSellerOfferRequest? request,
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken)
        {
            context.Response.Headers.CacheControl = "no-store";
            var gate = await ResolveGate(app, context, services, hasDatabase,
                cancellationToken);
            if (gate.RejectionStatus is { } denied)
                return Results.StatusCode(denied);
            if (request is null || offerId == Guid.Empty ||
                request.ExpectedRevision < 1 ||
                request.ExpectedRevision == int.MaxValue)
                return ValidationError();
            if (!TryGetIdempotencyKey(context, out var key))
                return ValidationError("Idempotency-Key");

            var digest = Hash(FormattableString.Invariant(
                $"PUBLISH|{offerId:D}|{request.ExpectedRevision}"));
            var db = services.GetRequiredService<HanaSellerDbContext>();
            try
            {
                await using var transaction = await db.Database
                    .BeginTransactionAsync(cancellationToken);
                var replay = await FindReplay(db, gate.AccountId!.Value,
                    key, digest, offerId, cancellationToken);
                if (replay is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return replay.Value.Result is { } result
                        ? Results.Ok(result) : Results.Conflict();
                }

                var current = await db.OfferDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == offerId &&
                        x.SellerAccountId == gate.AccountId.Value,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                if (current.Revision != request.ExpectedRevision ||
                    current.Status != SellerOfferDraftStates.Draft ||
                    current.PriceRials is not > 0 ||
                    current.SellableQuantity is not > 0)
                    return Results.Conflict();

                var product = await EligibleProduct(services, current.CatalogProductId,
                    cancellationToken);
                if (product is null || !FitsScale(current.SellableQuantity.Value,
                    product.QuantityScale))
                    return Results.Conflict();

                var now = services.GetRequiredService<IClock>()
                    .UtcNow.ToUniversalTime();
                var nextRevision = request.ExpectedRevision + 1;
                var changed = await db.OfferDrafts
                    .Where(x => x.Id == offerId &&
                        x.SellerAccountId == gate.AccountId.Value &&
                        x.Revision == request.ExpectedRevision &&
                        x.Status == SellerOfferDraftStates.Draft &&
                        x.PriceRials != null && x.SellableQuantity != null)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.Status, SellerOfferDraftStates.Published)
                        .SetProperty(x => x.Revision, nextRevision)
                        .SetProperty(x => x.UpdatedAtUtc, now), cancellationToken);
                if (changed != 1) return Results.Conflict();

                db.OfferMutations.Add(new SellerOfferMutationRecord
                {
                    Id = Guid.NewGuid(), OfferId = offerId,
                    SellerAccountId = gate.AccountId.Value,
                    ExpectedRevision = request.ExpectedRevision,
                    ResultingRevision = nextRevision,
                    Action = SellerOfferMutationActions.Published,
                    ResultingStatus = SellerOfferDraftStates.Published,
                    IdempotencyKey = key, RequestSha256 = digest,
                    PriceRials = current.PriceRials,
                    SellableQuantity = current.SellableQuantity,
                    CreatedAtUtc = now
                });
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Results.Ok(ToResponse(current, nextRevision,
                    SellerOfferDraftStates.Published, current.PriceRials,
                    current.SellableQuantity, now));
            }
            catch (DbUpdateException)
            {
                return Results.Conflict();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        }
    }

    private static async Task<SellerOfferDraftEndpoints.SellerGate> ResolveGate(
        WebApplication app, HttpContext context, IServiceProvider services, bool hasDatabase,
        CancellationToken cancellationToken)
    {
        // Offer routes use the same server-resolved session/role/activation gate.
        try
        {
            return await SellerOfferDraftEndpoints.ResolveSellerAsync(
                app, context, services, hasDatabase, cancellationToken);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return new(null, StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<CatalogProductForOffer?> EligibleProduct(
        IServiceProvider services, Guid catalogProductId,
        CancellationToken cancellationToken) =>
        await services.GetRequiredService<HanaCatalogDbContext>().Products
            .AsNoTracking()
            .Where(x => x.Id == catalogProductId &&
                x.Kind == CatalogProductKinds.Good &&
                x.State == PublicationStates.Published &&
                x.Category.State == PublicationStates.Published &&
                x.UnitName != null && x.QuantityScale != null)
            .Select(x => new CatalogProductForOffer(x.QuantityScale!.Value))
            .SingleOrDefaultAsync(cancellationToken);

    private static bool FitsScale(decimal quantity, short scale) =>
        quantity > 0 && decimal.Round(quantity, scale) == quantity;

    private static async Task<(bool Exists, SellerOfferMutationResponse? Result)?> FindReplay(
        HanaSellerDbContext db, Guid sellerAccountId, Guid key,
        string digest, Guid offerId, CancellationToken cancellationToken)
    {
        var mutation = await db.OfferMutations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.SellerAccountId == sellerAccountId &&
                x.IdempotencyKey == key, cancellationToken);
        if (mutation is null) return null;
        if (mutation.OfferId != offerId || mutation.RequestSha256 != digest)
            return (true, null);
        var offer = await db.OfferDrafts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == offerId &&
                x.SellerAccountId == sellerAccountId, cancellationToken);
        if (offer is null) return (true, null);
        return (true, ToResponse(offer, mutation.ResultingRevision,
            mutation.ResultingStatus, mutation.PriceRials,
            mutation.SellableQuantity, mutation.CreatedAtUtc));
    }

    private static SellerOfferMutationResponse ToResponse(
        SellerOfferDraftRecord offer, int revision, string status,
        long? priceRials, decimal? quantity, DateTimeOffset updatedAt) =>
        new(offer.Id, offer.CatalogProductId, status, revision,
            priceRials, quantity, offer.CreatedAtUtc, updatedAt);

    private static string Hash(string value) => Convert.ToHexStringLower(
        SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static bool TryGetIdempotencyKey(HttpContext context, out Guid key) =>
        Guid.TryParse(context.Request.Headers["Idempotency-Key"].ToString(), out key) &&
        key != Guid.Empty;

    private static IResult ValidationError(string field = "request") =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [field] = ["اطلاعات پیشنهاد معتبر نیست."]
        });

    private sealed record CatalogProductForOffer(short QuantityScale);
}

internal sealed record UpdateSellerOfferRequest(
    int ExpectedRevision, long PriceRials, decimal SellableQuantity);
internal sealed record PublishSellerOfferRequest(int ExpectedRevision);
internal sealed record SellerOfferMutationResponse(
    Guid Id, Guid CatalogProductId, string Status, int Revision,
    long? PriceRials, decimal? SellableQuantity,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
