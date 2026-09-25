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
                    draft.ApplicantType,
                    draft.CompletedStep,
                    draft.Status,
                    draft.Revision,
                    draft.SubmittedAtUtc
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

        routes.MapPut("/applicant-type", async (
            SellerApplicantTypeInput input,
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

            var applicantType = input.ApplicantType?.Trim().ToUpperInvariant();
            if (applicantType is not ("NATURAL" or "LEGAL"))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["applicantType"] = ["نوع متقاضی باید شخص حقیقی یا شخص حقوقی باشد."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();

                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      applicant_type = {applicantType},
                      completed_step = GREATEST(completed_step, 2),
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        applicantType,
                        completedStep = 2
                    })
                    : Results.Conflict(new
                    {
                        message = "پیش‌نویس تغییر کرده یا دیگر قابل ویرایش نیست؛ نوع متقاضی ذخیره نشد."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerApplicantType")
        .ProducesValidationProblem();

        routes.MapPost("/submit", async (SellerRegistrationSubmitInput input,
            HttpContext context, IServiceProvider services,
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
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"],
                    out var submissionKey) || submissionKey == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["idempotencyKey"] = ["کلید ثبت درخواست معتبر نیست."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();

                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      status = 'SUBMITTED',
                      revision = revision + 1,
                      submission_key = {submissionKey},
                      submission_expected_revision = {input.Revision},
                      submitted_at_utc = {now},
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND completed_step = 6
                      AND revision = {input.Revision}
                    """, cancellationToken);

                if (updated == 1)
                    return Results.Ok(new
                    {
                        status = "SUBMITTED",
                        revision = input.Revision + 1,
                        submittedAtUtc = now
                    });

                var current = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                if (current.Status == "SUBMITTED" &&
                    current.SubmissionKey == submissionKey &&
                    current.SubmissionExpectedRevision == input.Revision &&
                    current.SubmittedAtUtc is { } submittedAt)
                    return Results.Ok(new
                    {
                        status = "SUBMITTED",
                        revision = current.Revision,
                        submittedAtUtc = submittedAt
                    });

                return Results.Conflict(new
                {
                    message = current.Status == "SUBMITTED"
                        ? "این درخواست قبلاً برای بررسی ثبت شده است."
                        : current.CompletedStep < 6
                            ? "ثبت نهایی فقط پس از تکمیل مراحل ۱ تا ۶ مجاز است."
                            : "پیش‌نویس تغییر کرده است؛ قبل از ثبت نهایی تازه‌ترین نسخه را دریافت کنید.",
                    currentRevision = current.Revision,
                    currentStatus = current.Status,
                    completedStep = current.CompletedStep
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SubmitMySellerRegistration")
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

internal sealed record SellerApplicantTypeInput(
    string? ApplicantType,
    int Revision);

internal sealed record SellerRegistrationSubmitInput(int Revision);
