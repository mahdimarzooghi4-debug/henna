using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class AdminSellerApplicationEndpoints
{
    internal static void MapAdminSellerApplications(
        this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/admin/seller-applications")
            .WithTags("Admin");

        routes.MapGet("", async (
            HttpContext context,
            IServiceProvider services,
            int? page,
            int? pageSize,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var auth = await AuthorizeAdminAsync(
                context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            var requestedPage = page ?? 1;
            var requestedPageSize = pageSize ?? 20;
            if (requestedPage < 1 || requestedPage > 10_000 ||
                requestedPageSize < 1 || requestedPageSize > 50)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["pagination"] = ["صفحه‌بندی معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var query = db.RegistrationDrafts.AsNoTracking()
                    .Where(x => x.Status == "SUBMITTED")
                    .OrderByDescending(x => x.SubmittedAtUtc)
                    .ThenBy(x => x.AccountId);

                var total = await query.CountAsync(cancellationToken);
                var items = await query
                    .Skip((requestedPage - 1) * requestedPageSize)
                    .Take(requestedPageSize)
                    .Select(x => new
                    {
                        applicationId = x.AccountId,
                        x.StoreName,
                        x.OwnerName,
                        x.ApplicantType,
                        x.IdentityStatus,
                        x.BusinessCategoryId,
                        x.BusinessName,
                        x.OfferingType,
                        x.Status,
                        x.Revision,
                        x.SubmittedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    items,
                    page = requestedPage,
                    pageSize = requestedPageSize,
                    total
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("ListSubmittedSellerApplications")
        .ProducesValidationProblem();

        routes.MapGet("/{applicationId:guid}", async (
            Guid applicationId,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var auth = await AuthorizeAdminAsync(
                context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var application = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.AccountId == applicationId &&
                            x.Status == "SUBMITTED",
                        cancellationToken);
                if (application is null) return Results.NotFound();

                return Results.Ok(new
                {
                    applicationId = application.AccountId,
                    application.StoreName,
                    application.OwnerName,
                    application.ApplicantType,
                    application.IdentityStatus,
                    nationalCodeMasked = MaskNationalCode(
                        application.NaturalNationalCode),
                    application.LegalNationalId,
                    application.LegalName,
                    application.LegalRepresentativeName,
                    legalRepresentativePhoneMasked = MaskOptionalPhone(
                        application.LegalRepresentativePhone),
                    application.BusinessCategoryId,
                    application.BusinessName,
                    application.BusinessDescription,
                    application.BusinessPhone,
                    application.OfferingType,
                    application.ActivityProvinceId,
                    application.ActivityCityId,
                    application.ActivityAddress,
                    application.ActivityHours,
                    application.SellerDelivery,
                    application.Pickup,
                    application.ServiceArea,
                    phoneMasked = MaskPhone(application.Phone),
                    application.City,
                    application.Address,
                    application.PostalCode,
                    application.Status,
                    application.Revision,
                    application.SubmittedAtUtc
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSubmittedSellerApplication");
    }

    private static async Task<(Guid? AccountId, IResult? Error)> AuthorizeAdminAsync(
        HttpContext context,
        IServiceProvider services,
        bool hasDatabase,
        CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase)
            return (null,
                Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(
            token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());

        var roles = services.GetRequiredService<RoleAuthorizationService>();
        if (!await roles.HasRoleAsync(
            accountId.Value, HanaRoles.Admin, cancellationToken))
            return (null, Results.StatusCode(StatusCodes.Status403Forbidden));

        return (accountId, null);
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _) ? token : null;
    }

    private static string MaskPhone(string? phone) =>
        phone is { Length: 11 }
            ? phone[..4] + "*******"
            : "***********";

    private static string? MaskOptionalPhone(string? phone) =>
        phone is { Length: 11 }
            ? phone[..4] + "*******"
            : null;

    private static string? MaskNationalCode(string? nationalCode) =>
        nationalCode is { Length: 10 }
            ? "******" + nationalCode[^4..]
            : null;
}
