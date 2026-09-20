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
                    draft.Status,
                    draft.Revision
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
            // Revision 0 means "create only"; existing drafts require the
            // exact last-seen revision, preventing stale tabs from erasing data.
            if (input.Revision is not { } expectedRevision ||
                expectedRevision < 0 || expectedRevision == int.MaxValue)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["revision"] = ["نسخهٔ پیش‌نویس معتبر نیست؛ صفحه را بازخوانی کنید."]
                });
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
                // A one-statement compare-and-swap for both creation and edit.
                // UPDATE and INSERT are each atomic in PostgreSQL across API
                // replicas; stale writes never replace a newer draft.
                var updated = expectedRevision == 0
                    ? await db.Database.ExecuteSqlInterpolatedAsync($"""
                        INSERT INTO seller.registration_drafts
                          (account_id, store_name, owner_name, phone, city,
                           address, postal_code, status, revision, updated_at_utc)
                        VALUES ({accountId.Value}, {fields.StoreName},
                          {fields.OwnerName}, {fields.Phone}, {fields.City},
                          {fields.Address}, {fields.PostalCode}, 'DRAFT', 1, {now})
                        ON CONFLICT (account_id) DO NOTHING
                        """, cancellationToken)
                    : await db.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE seller.registration_drafts SET
                          store_name = {fields.StoreName},
                          owner_name = {fields.OwnerName},
                          phone = {fields.Phone},
                          city = {fields.City},
                          address = {fields.Address},
                          postal_code = {fields.PostalCode},
                          revision = revision + 1,
                          updated_at_utc = {now}
                        WHERE account_id = {accountId.Value}
                          AND status = 'DRAFT'
                          AND revision = {expectedRevision}
                        """, cancellationToken);
                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT", revision = expectedRevision + 1
                    })
                    : Results.Conflict(new
                    {
                        message = "این پیش‌نویس جای دیگری تغییر کرده یا دیگر قابل ویرایش نیست؛ قبل از ذخیره دوباره تازه‌ترین نسخه را بگیرید."
                    });
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
    string? City, string? Address, string? PostalCode,
    int? Revision);
