using Hana.Application.Time;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerOfferDraftEndpoints
{
    internal static void MapSellerOfferDrafts(
        this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/offers")
            .WithTags("Seller Offers");

        routes.MapGet("", async (
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            SellerGate gate;
            try
            {
                gate = await ResolveSellerAsync(
                    app, context, services, hasDatabase, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
            if (gate.RejectionStatus is { } status)
                return Results.StatusCode(status);

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var items = await db.OfferDrafts.AsNoTracking()
                    .Where(x => x.SellerAccountId == gate.AccountId!.Value)
                    .OrderByDescending(x => x.CreatedAtUtc)
                    .ThenByDescending(x => x.Id)
                    .Select(x => new SellerOfferDraftResponse(
                        x.Id, x.CatalogProductId, x.Status, x.Revision,
                        x.CreatedAtUtc, x.UpdatedAtUtc))
                    .ToListAsync(cancellationToken);
                return Results.Ok(new { items });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSellerOfferDrafts");

        routes.MapPost("", async (
            CreateSellerOfferDraftRequest? request,
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            SellerGate gate;
            try
            {
                gate = await ResolveSellerAsync(
                    app, context, services, hasDatabase, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
            if (gate.RejectionStatus is { } status)
                return Results.StatusCode(status);

            if (request is null ||
                request.CatalogProductId == Guid.Empty)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["catalogProductId"] =
                            ["شناسه کالای کاتالوگ معتبر نیست."]
                    });

            if (!Guid.TryParse(
                context.Request.Headers["Idempotency-Key"].ToString(),
                out var key) || key == Guid.Empty)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["Idempotency-Key"] =
                            ["کلید یکتای درخواست معتبر نیست."]
                    });

            try
            {
                var sellerDb =
                    services.GetRequiredService<HanaSellerDbContext>();
                var existing = await sellerDb.OfferDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x =>
                        x.SellerAccountId == gate.AccountId!.Value &&
                        x.IdempotencyKey == key, cancellationToken);
                if (existing is not null)
                    return existing.CatalogProductId ==
                        request.CatalogProductId
                        ? Results.Ok(ToResponse(existing))
                        : Results.Conflict();

                var catalogDb =
                    services.GetRequiredService<HanaCatalogDbContext>();
                var eligible = await catalogDb.Products.AsNoTracking()
                    .AnyAsync(x =>
                        x.Id == request.CatalogProductId &&
                        x.Kind == CatalogProductKinds.Good &&
                        x.State == PublicationStates.Published &&
                        x.Category.State == PublicationStates.Published,
                        cancellationToken);
                if (!eligible)
                    return Results.Conflict();

                var now = services.GetRequiredService<IClock>()
                    .UtcNow.ToUniversalTime();
                var draft = new SellerOfferDraftRecord
                {
                    Id = Guid.NewGuid(),
                    SellerAccountId = gate.AccountId.Value,
                    CatalogProductId = request.CatalogProductId,
                    Status = SellerOfferDraftStates.Draft,
                    Revision = 1,
                    IdempotencyKey = key,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                };
                sellerDb.OfferDrafts.Add(draft);
                await sellerDb.SaveChangesAsync(cancellationToken);
                return Results.Json(
                    ToResponse(draft),
                    statusCode: StatusCodes.Status201Created);
            }
            catch (DbUpdateException)
            {
                // A concurrent retry can pass the initial lookup. The unique
                // seller/key index remains the authority for idempotency.
                try
                {
                    var sellerDb =
                        services.GetRequiredService<HanaSellerDbContext>();
                    sellerDb.ChangeTracker.Clear();
                    var existing = await sellerDb.OfferDrafts.AsNoTracking()
                        .SingleOrDefaultAsync(x =>
                            x.SellerAccountId == gate.AccountId!.Value &&
                            x.IdempotencyKey == key, cancellationToken);
                    if (existing is not null)
                        return existing.CatalogProductId ==
                            request.CatalogProductId
                            ? Results.Ok(ToResponse(existing))
                            : Results.Conflict();
                }
                catch (Exception) when (
                    !cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
                return Results.Conflict();
            }
            catch (Exception) when (
                !cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("CreateSellerOfferDraft")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status409Conflict);
    }

    private static async Task<SellerGate> ResolveSellerAsync(
        WebApplication app, HttpContext context, IServiceProvider services,
        bool hasDatabase, CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
            return new(null, StatusCodes.Status503ServiceUnavailable);

        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith(
                "Bearer ", StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(header[7..], out _))
            return new(null, StatusCodes.Status401Unauthorized);

        if (!hasDatabase)
            return new(null, StatusCodes.Status503ServiceUnavailable);

        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(
            header[7..], cancellationToken);
        if (accountId is null)
            return new(null, StatusCodes.Status401Unauthorized);

        var roles = services.GetRequiredService<RoleAuthorizationService>();
        if (!await roles.HasRoleAsync(
            accountId.Value, HanaRoles.Seller, cancellationToken))
            return new(null, StatusCodes.Status403Forbidden);

        var sellerDb = services.GetRequiredService<HanaSellerDbContext>();
        var activated = await sellerDb.RegistrationDrafts.AsNoTracking()
            .AnyAsync(x =>
                x.AccountId == accountId.Value &&
                x.Status == "SUBMITTED" &&
                x.ReviewStatus == "APPROVED" &&
                x.ActivatedAtUtc != null,
                cancellationToken);
        return activated
            ? new(accountId.Value, null)
            : new(null, StatusCodes.Status403Forbidden);
    }

    private static SellerOfferDraftResponse ToResponse(
        SellerOfferDraftRecord value) =>
        new(value.Id, value.CatalogProductId, value.Status,
            value.Revision, value.CreatedAtUtc, value.UpdatedAtUtc);

    private sealed record SellerGate(Guid? AccountId, int? RejectionStatus);
}

internal sealed record CreateSellerOfferDraftRequest(Guid CatalogProductId);

internal sealed record SellerOfferDraftResponse(
    Guid Id, Guid CatalogProductId, string Status, int Revision,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
