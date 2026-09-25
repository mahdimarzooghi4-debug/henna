using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerBusinessInformationEndpoints
{
    internal static void MapSellerBusinessInformation(
        this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/registration")
            .WithTags("Seller");

        routes.MapGet("/business-categories", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var items = await db.BusinessCategories.AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Name)
                    .ThenBy(x => x.Id)
                    .Select(x => new { x.Id, x.Name })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    configured = items.Count > 0,
                    items
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("ListSellerBusinessCategories");

        routes.MapPut("/business-information", async (
            SellerBusinessInformationInput input,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["revision"] = ["نسخهٔ پیش‌نویس معتبر نیست؛ صفحه را بازخوانی کنید."]
                });

            var businessName = SellerIdentityInputValidation.CleanText(
                input.BusinessName, 180);
            var description = SellerIdentityInputValidation.CleanText(
                input.Description, 500);
            var phone = SellerIdentityInputValidation.NormalizeDigits(
                input.BusinessPhone);
            var offeringType = input.OfferingType?.Trim().ToUpperInvariant();

            if (input.CategoryId == Guid.Empty ||
                businessName is null ||
                description is null ||
                phone.Length != 11 ||
                phone[0] != '0' ||
                phone.Any(ch => ch is < '0' or > '9') ||
                offeringType is not ("GOOD" or "SERVICE" or "BOTH"))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["businessInformation"] =
                        ["اطلاعات کسب‌وکار کامل یا معتبر نیست."]
                });

            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var category = await db.BusinessCategories.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.Id == input.CategoryId && x.IsActive,
                        cancellationToken);
                if (category is null)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["categoryId"] =
                                ["دسته‌بندی انتخاب‌شده فعال یا معتبر نیست."]
                        });

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      business_category_id = {input.CategoryId},
                      business_name = {businessName},
                      business_description = {description},
                      business_phone = {phone},
                      offering_type = {offeringType},
                      completed_step = 4,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND completed_step = 3
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        completedStep = 4,
                        category = new
                        {
                            id = category.Id,
                            name = category.Name
                        },
                        businessName,
                        description,
                        businessPhone = phone,
                        offeringType
                    })
                    : Results.Conflict(new
                    {
                        message =
                            "پیش‌نویس تغییر کرده یا مرحله اطلاعات کسب‌وکار دیگر قابل ویرایش نیست."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerBusinessInformation")
        .ProducesValidationProblem();
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _) ? token : null;
    }
}

internal sealed record SellerBusinessInformationInput(
    Guid CategoryId,
    string? BusinessName,
    string? Description,
    string? BusinessPhone,
    string? OfferingType,
    int Revision);
