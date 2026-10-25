using Hana.Infrastructure.External;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;

namespace Hana.Api;

internal static class AdminExternalIntegrationEndpoints
{
    internal static void MapAdminExternalIntegrations(
        this WebApplication app,
        bool hasIdentityDatabase,
        bool hasCommerceDatabase)
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
                var ibanOwnership = services
                    .GetRequiredService<IExternalIbanOwnershipVerifier>();
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
                    ibanOwnership = new
                    {
                        configured = ibanOwnership.IsAvailable,
                        requiredForWithdrawalOwnership = true
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
                        ibanOwnership.IsAvailable &&
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

        app.MapGet("/api/v1/admin/integrations/mono/orders/{orderId:guid}/status", async (
            Guid orderId, HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var admin = await ResolveAdminAsync(context, services,
                hasIdentityDatabase, cancellationToken);
            if (admin.Error is not null) return admin.Error;
            if (!hasCommerceDatabase) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var status = await services.GetRequiredService<MonoDeliveryStatusReader>()
                    .ReadAsync(orderId, cancellationToken);
                return Results.Ok(status);
            }
            catch (MonoDeliveryCorrelationException exception) when (!cancellationToken.IsCancellationRequested)
            {
                return exception.Code switch
                {
                    "CORRELATION_NOT_FOUND" => Results.NotFound(),
                    _ => Results.Conflict(new { code = exception.Code })
                };
            }
            catch (MonoLogisticsException) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetAdminMonoOrderDeliveryStatus")
        .WithTags("Admin")
        .Produces<MonoDeliveryStatusRead>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        app.MapGet("/api/v1/admin/integrations/mono/branches", async (
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var admin = await ResolveAdminAsync(context, services,
                hasIdentityDatabase, cancellationToken);
            if (admin.Error is not null) return admin.Error;
            var client = services.GetRequiredService<IMonoLogisticsClient>();
            if (!client.IsAvailable) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            try
            {
                return Results.Ok(await client.ListBranchesAsync(cancellationToken));
            }
            catch (MonoLogisticsException) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("ListAdminMonoBranches")
        .WithTags("Admin")
        .Produces<MonoBranchList>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        app.MapGet("/api/v1/admin/integrations/mono/sellers/{sellerId:guid}/branch-mapping", async (
            Guid sellerId, HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var admin = await ResolveAdminAsync(context, services,
                hasIdentityDatabase, cancellationToken);
            if (admin.Error is not null) return admin.Error;
            if (!hasCommerceDatabase) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            var mapping = await services.GetRequiredService<MonoSellerBranchMappingService>()
                .FindAsync(sellerId, cancellationToken);
            return mapping is null ? Results.NotFound() : Results.Ok(mapping);
        })
        .WithName("GetAdminMonoSellerBranchMapping")
        .WithTags("Admin")
        .Produces<MonoSellerBranchMappingSnapshot>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        app.MapPut("/api/v1/admin/integrations/mono/sellers/{sellerId:guid}/branch-mapping", async (
            Guid sellerId, MonoSellerBranchMappingRequest payload,
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var admin = await ResolveAdminAsync(context, services,
                hasIdentityDatabase, cancellationToken);
            if (admin.Error is not null) return admin.Error;
            if (!hasCommerceDatabase) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            if (payload.ExpectedRevision < 0 || string.IsNullOrWhiteSpace(payload.MonoBranchId))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["mapping"] = ["اطلاعات نگاشت شعبه معتبر نیست."]
                });
            try
            {
                var saved = await services.GetRequiredService<MonoSellerBranchMappingService>()
                    .SetAsync(sellerId, payload.MonoBranchId, admin.AccountId!.Value,
                        payload.ExpectedRevision, cancellationToken);
                return Results.Ok(saved);
            }
            catch (MonoSellerBranchMappingException exception) when (!cancellationToken.IsCancellationRequested)
            {
                return exception.Code switch
                {
                    "MAPPING_REVISION_CONFLICT" => Results.Conflict(new { code = exception.Code }),
                    "SELLER_NOT_ACTIVE" => Results.Conflict(new { code = exception.Code }),
                    "MONO_BRANCH_NOT_ACTIVE_OR_NOT_OWNED" => Results.ValidationProblem(
                        new Dictionary<string, string[]> { ["monoBranchId"] = ["شعبهٔ فعال و متعلق به حساب مونو انتخاب نشده است."] }),
                    _ => Results.ValidationProblem(
                        new Dictionary<string, string[]> { ["mapping"] = ["اطلاعات نگاشت شعبه معتبر نیست."] })
                };
            }
            catch (MonoLogisticsException) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SetAdminMonoSellerBranchMapping")
        .WithTags("Admin")
        .Produces<MonoSellerBranchMappingSnapshot>(StatusCodes.Status200OK)
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }

    private static async Task<(Guid? AccountId, IResult? Error)> ResolveAdminAsync(
        HttpContext context, IServiceProvider services, bool hasIdentityDatabase,
        CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps &&
            !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            return (null, Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(header[7..], out _))
            return (null, Results.Unauthorized());
        if (!hasIdentityDatabase)
            return (null, Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        try
        {
            var accountId = await services.GetRequiredService<AuthSessionService>()
                .ResolveAccountAsync(header[7..], cancellationToken);
            if (accountId is null) return (null, Results.Unauthorized());
            if (!await services.GetRequiredService<RoleAuthorizationService>()
                    .HasRoleAsync(accountId.Value, HanaRoles.Admin, cancellationToken))
                return (null, Results.StatusCode(StatusCodes.Status403Forbidden));
            return (accountId, null);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        }
    }
}

internal sealed record MonoSellerBranchMappingRequest(string MonoBranchId, int ExpectedRevision);
