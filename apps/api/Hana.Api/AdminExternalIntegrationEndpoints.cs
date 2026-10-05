using Hana.Infrastructure.External;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;

namespace Hana.Api;

internal static class AdminExternalIntegrationEndpoints
{
    internal static void MapAdminExternalIntegrations(
        this WebApplication app,
        bool hasIdentityDatabase)
    {
        app.MapGet("/api/v1/admin/integrations/status", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps &&
                !context.RequestServices
                    .GetRequiredService<IWebHostEnvironment>().IsDevelopment())
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);

            var header = context.Request.Headers.Authorization.ToString();
            if (!header.StartsWith("Bearer ",
                    StringComparison.OrdinalIgnoreCase) ||
                !SessionTokenCodec.TryComputeDigest(header[7..], out _))
                return Results.Unauthorized();
            if (!hasIdentityDatabase)
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services
                    .GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(header[7..], cancellationToken);
                if (accountId is null) return Results.Unauthorized();
                if (!await services
                    .GetRequiredService<RoleAuthorizationService>()
                    .HasRoleAsync(accountId.Value, HanaRoles.Admin,
                        cancellationToken))
                    return Results.StatusCode(StatusCodes.Status403Forbidden);

                var sms = services.GetRequiredService<IOtpSmsSender>();
                var identity = services
                    .GetRequiredService<ISellerNaturalIdentityVerifier>();
                var payment = services
                    .GetRequiredService<IExternalPaymentProvider>();
                var logistics = services
                    .GetRequiredService<IExternalLogisticsProvider>();

                return Results.Ok(new
                {
                    sms = new
                    {
                        configured = sms.IsAvailable,
                        requiredForPublicSignIn = true
                    },
                    sellerIdentity = new
                    {
                        configured = identity.IsAvailable,
                        requiredForNaturalSellerVerification = true
                    },
                    payment = new
                    {
                        configured = payment.IsAvailable,
                        requiredForExternalPayment = true
                    },
                    logistics = new
                    {
                        configured = logistics.IsAvailable,
                        requiredForDelivery = true
                    },
                    allExternalReady =
                        sms.IsAvailable &&
                        identity.IsAvailable &&
                        payment.IsAvailable &&
                        logistics.IsAvailable
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetAdminExternalIntegrationStatus")
        .WithTags("Admin")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
