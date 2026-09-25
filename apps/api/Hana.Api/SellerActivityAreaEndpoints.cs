using Hana.Application.Time;
using Hana.Infrastructure.Geography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerActivityAreaEndpoints
{
    internal static void MapSellerActivityArea(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapPut("/api/v1/seller/registration/activity-area", async (
            SellerActivityAreaInput input,
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
                    ["revision"] = ["نسخهٔ پیش‌نویس معتبر نیست."]
                });

            var address = SellerIdentityInputValidation.CleanText(
                input.Address, 500);
            var hours = SellerIdentityInputValidation.CleanText(
                input.ActivityHours, 180);
            var serviceArea = SellerIdentityInputValidation.CleanText(
                input.ServiceArea, 240);

            if (input.ProvinceId == Guid.Empty ||
                input.CityId == Guid.Empty ||
                address is null || hours is null || serviceArea is null ||
                (!input.SellerDelivery && !input.Pickup))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["activityArea"] =
                            ["محدوده فعالیت کامل یا معتبر نیست."]
                    });

            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services
                    .GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var geography = services
                    .GetRequiredService<HanaGeographyDbContext>();
                var city = await geography.Cities.AsNoTracking()
                    .Where(x =>
                        x.Id == input.CityId &&
                        x.ProvinceId == input.ProvinceId &&
                        x.State == GeographyStates.Selectable)
                    .Select(x => new
                    {
                        x.Id,
                        x.Name,
                        x.ProvinceId
                    })
                    .SingleOrDefaultAsync(cancellationToken);
                if (city is null)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["cityId"] =
                                ["شهر انتخاب‌شده معتبر یا قابل انتخاب نیست."]
                        });

                var province = await geography.Provinces.AsNoTracking()
                    .Where(x =>
                        x.Id == input.ProvinceId &&
                        x.State == GeographyStates.Selectable)
                    .Select(x => new { x.Id, x.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                if (province is null)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["provinceId"] =
                                ["استان انتخاب‌شده معتبر یا قابل انتخاب نیست."]
                        });

                var seller = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();

                var updated = await seller.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      activity_province_id = {input.ProvinceId},
                      activity_city_id = {input.CityId},
                      activity_address = {address},
                      activity_hours = {hours},
                      seller_delivery = {input.SellerDelivery},
                      pickup = {input.Pickup},
                      service_area = {serviceArea},
                      completed_step = 5,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND completed_step = 4
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        completedStep = 5,
                        province = new { id = province.Id, name = province.Name },
                        city = new { id = city.Id, name = city.Name },
                        address,
                        activityHours = hours,
                        sellerDelivery = input.SellerDelivery,
                        pickup = input.Pickup,
                        serviceArea
                    })
                    : Results.Conflict(new
                    {
                        message =
                            "پیش‌نویس تغییر کرده یا مرحله محدوده فعالیت دیگر قابل ویرایش نیست."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerActivityArea")
        .WithTags("Seller")
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

internal sealed record SellerActivityAreaInput(
    Guid ProvinceId,
    Guid CityId,
    string? Address,
    string? ActivityHours,
    bool SellerDelivery,
    bool Pickup,
    string? ServiceArea,
    int Revision);
