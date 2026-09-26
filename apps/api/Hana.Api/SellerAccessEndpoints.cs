using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerAccessEndpoints
{
    internal static void MapSellerAccess(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapGet("/api/v1/seller/access", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);

            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (!hasDatabase)
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);

            try
            {
                var sessions =
                    services.GetRequiredService<AuthSessionService>();
                var accountId = await sessions.ResolveAccountAsync(
                    token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var roles =
                    services.GetRequiredService<RoleAuthorizationService>();
                if (!await roles.HasRoleAsync(
                    accountId.Value, HanaRoles.Seller,
                    cancellationToken))
                    return Results.StatusCode(
                        StatusCodes.Status403Forbidden);

                var db =
                    services.GetRequiredService<HanaSellerDbContext>();
                var activation = await db.RegistrationDrafts
                    .AsNoTracking()
                    .Where(x =>
                        x.AccountId == accountId.Value &&
                        x.Status == "SUBMITTED" &&
                        x.ReviewStatus == "APPROVED" &&
                        x.ActivatedAtUtc != null)
                    .Select(x => new
                    {
                        x.TrackingCode,
                        x.ActivatedAtUtc,
                        x.StoreName,
                        x.BusinessName,
                        x.OfferingType,
                        x.ActivityProvinceId,
                        x.ActivityCityId
                    })
                    .SingleOrDefaultAsync(cancellationToken);

                if (activation is null)
                    return Results.StatusCode(
                        StatusCodes.Status403Forbidden);

                return Results.Ok(new
                {
                    sellerAccess = true,
                    sellerPanelEnabled = true,
                    activation.TrackingCode,
                    activation.ActivatedAtUtc,
                    activation.StoreName,
                    activation.BusinessName,
                    activation.OfferingType,
                    activation.ActivityProvinceId,
                    activation.ActivityCityId,
                    capabilities = new
                    {
                        dashboard = true,
                        orders = false,
                        listings = false,
                        inventory = false,
                        pricing = false,
                        settlements = false,
                        reports = false
                    }
                });
            }
            catch (Exception) when (
                !cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSellerAccess")
        .WithTags("Seller");
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ",
            StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _)
            ? token
            : null;
    }
}
