using Hana.Application.Time;
using Hana.Domain.Seller;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerRegistrationEndpoints
{
    internal static void MapSellerRegistration(this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/registration")
            .WithTags("Seller");

        routes.MapGet("", async (HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
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
                var draft = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                return draft is null ? Results.NotFound() : Results.Ok(new
                {
                    draft.StoreName,
                    draft.OwnerName,
                    draft.Phone,
                    draft.City,
                    draft.Address,
                    draft.PostalCode,
                    draft.Status
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetMySellerRegistrationDraft");

        routes.MapPut("", async (SellerRegistrationInput input,
            HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (!SellerRegistrationFields.TryCreate(input.StoreName,
                input.OwnerName, input.Phone, input.City,
                input.Address, input.PostalCode, out var fields))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["registration"] = ["اطلاعات اولیه فروشگاه معتبر نیست."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                // A seller draft cannot bind an unverified/third-party number
                // to a verified account. Later contacts need a separate proof.
                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                var account = await identity.Accounts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == accountId,
                        cancellationToken);
                if (account?.PhoneVerifiedAtUtc is null ||
                    account.NormalizedPhone != fields!.Phone)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["phone"] = ["شماره مسئول باید شماره تأییدشده حساب باشد."]
                        });

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO seller.registration_drafts
                      (account_id, store_name, owner_name, phone, city,
                       address, postal_code, status, updated_at_utc)
                    VALUES ({accountId.Value}, {fields.StoreName},
                      {fields.OwnerName}, {fields.Phone}, {fields.City},
                      {fields.Address}, {fields.PostalCode}, 'DRAFT', {now})
                    ON CONFLICT (account_id) DO UPDATE SET
                      store_name = EXCLUDED.store_name,
                      owner_name = EXCLUDED.owner_name,
                      phone = EXCLUDED.phone,
                      city = EXCLUDED.city,
                      address = EXCLUDED.address,
                      postal_code = EXCLUDED.postal_code,
                      updated_at_utc = EXCLUDED.updated_at_utc
                    WHERE registration_drafts.status = 'DRAFT'
                    """, cancellationToken);
                return updated == 1
                    ? Results.Ok(new { status = "DRAFT" })
                    : Results.Conflict(new { message =
                        "وضعیت ثبت‌نام اجازه ویرایش اطلاعات اولیه را نمی‌دهد." });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                // No PII/DB exception details in public responses.
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerRegistrationDraft")
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

internal sealed record SellerRegistrationInput(
    string? StoreName, string? OwnerName, string? Phone,
    string? City, string? Address, string? PostalCode);
