using Hana.Application.Time;
using Hana.Domain.Seller;
using Hana.Infrastructure.Geography;
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
                if (draft is null) return Results.NotFound();

                var businessCategoryName = draft.BusinessCategoryId is { } categoryId
                    ? await db.BusinessCategories.AsNoTracking()
                        .Where(x => x.Id == categoryId)
                        .Select(x => x.Name)
                        .SingleOrDefaultAsync(cancellationToken)
                    : null;

                var geography = services.GetRequiredService<HanaGeographyDbContext>();
                var activityProvinceName = draft.ActivityProvinceId is { } provinceId
                    ? await geography.Provinces.AsNoTracking()
                        .Where(x => x.Id == provinceId)
                        .Select(x => x.Name)
                        .SingleOrDefaultAsync(cancellationToken)
                    : null;
                var activityCityName = draft.ActivityCityId is { } cityId
                    ? await geography.Cities.AsNoTracking()
                        .Where(x => x.Id == cityId)
                        .Select(x => x.Name)
                        .SingleOrDefaultAsync(cancellationToken)
                    : null;

                return Results.Ok(new
                {
                    draft.StoreName,
                    draft.OwnerName,
                    draft.Phone,
                    draft.City,
                    draft.Address,
                    draft.PostalCode,
                    draft.ApplicantType,
                    draft.IdentityStatus,
                    nationalCodeMasked = MaskNationalCode(draft.NaturalNationalCode),
                    draft.LegalNationalId,
                    draft.LegalName,
                    draft.LegalRepresentativeName,
                    draft.LegalRepresentativePhone,
                    draft.BusinessCategoryId,
                    businessCategoryName,
                    draft.BusinessName,
                    draft.BusinessDescription,
                    draft.BusinessPhone,
                    draft.OfferingType,
                    draft.ActivityProvinceId,
                    activityProvinceName,
                    draft.ActivityCityId,
                    activityCityName,
                    draft.ActivityAddress,
                    draft.ActivityHours,
                    draft.SellerDelivery,
                    draft.Pickup,
                    draft.ServiceArea,
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
                          AND completed_step = 1
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
                      natural_national_code = NULL,
                      legal_national_id = NULL,
                      legal_name = NULL,
                      legal_representative_name = NULL,
                      legal_representative_phone = NULL,
                      identity_status = NULL,
                      completed_step = 2,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND completed_step <= 2
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

        routes.MapPost("/identity/natural", async (
            SellerNaturalIdentityInput input,
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

            var nationalCode = SellerIdentityInputValidation.NormalizeDigits(
                input.NationalCode);
            if (!SellerIdentityInputValidation.IsIranianNationalCode(nationalCode))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["nationalCode"] = ["فرمت کد ملی صحیح نیست."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                var account = await identity.Accounts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == accountId,
                        cancellationToken);
                if (account?.PhoneVerifiedAtUtc is null)
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["phone"] = ["شماره همراه حساب هنوز تأیید نشده است."]
                    });

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var current = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.AccountId == accountId,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                if (current.Status != "DRAFT" ||
                    current.ApplicantType != "NATURAL" ||
                    current.CompletedStep != 2 ||
                    current.Revision != input.Revision)
                    return Results.Conflict(new
                    {
                        message = "مرحله احراز هویت با نسخه یا نوع متقاضی فعلی سازگار نیست.",
                        currentRevision = current.Revision,
                        currentStatus = current.Status,
                        completedStep = current.CompletedStep
                    });

                var verifier = services
                    .GetRequiredService<ISellerNaturalIdentityVerifier>();
                if (!verifier.IsAvailable)
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);

                var verification = await verifier.VerifyAsync(
                    nationalCode,
                    account.NormalizedPhone,
                    cancellationToken);
                if (verification == SellerIdentityVerificationResult.Unavailable)
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                if (verification == SellerIdentityVerificationResult.NotMatched)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["nationalCode"] = ["اطلاعات هویتی با حساب تأییدشده تطبیق داده نشد."]
                        });

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      natural_national_code = {nationalCode},
                      identity_status = 'VERIFIED',
                      completed_step = 3,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND applicant_type = 'NATURAL'
                      AND completed_step = 2
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        identityStatus = "VERIFIED",
                        nationalCodeMasked = MaskNationalCode(nationalCode),
                        completedStep = 3
                    })
                    : Results.Conflict(new
                    {
                        message = "پیش‌نویس هنگام استعلام تغییر کرد؛ نتیجه روی نسخهٔ جدید اعمال نشد."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("VerifyMyNaturalSellerIdentity")
        .ProducesValidationProblem();

        routes.MapPut("/identity/legal", async (
            SellerLegalIdentityInput input,
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

            var legalNationalId = SellerIdentityInputValidation.NormalizeDigits(
                input.LegalNationalId);
            var representativePhone = SellerIdentityInputValidation.NormalizeDigits(
                input.RepresentativePhone);
            var legalName = SellerIdentityInputValidation.CleanText(
                input.LegalName, 180);
            var representativeName = SellerIdentityInputValidation.CleanText(
                input.RepresentativeName, 120);
            if (!SellerIdentityInputValidation.IsElevenDigits(legalNationalId) ||
                !SellerIdentityInputValidation.IsPhone(representativePhone) ||
                legalName is null || representativeName is null)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["identity"] = ["اطلاعات شخصیت حقوقی معتبر نیست."]
                });
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                var account = await identity.Accounts.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == accountId,
                        cancellationToken);
                if (account?.PhoneVerifiedAtUtc is null ||
                    account.NormalizedPhone != representativePhone)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["representativePhone"] =
                                ["شماره موبایل نماینده باید همان شماره تأییدشده حساب باشد."]
                        });

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      legal_national_id = {legalNationalId},
                      legal_name = {legalName},
                      legal_representative_name = {representativeName},
                      legal_representative_phone = {representativePhone},
                      identity_status = 'RECORDED',
                      completed_step = 3,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND applicant_type = 'LEGAL'
                      AND completed_step = 2
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        identityStatus = "RECORDED",
                        completedStep = 3
                    })
                    : Results.Conflict(new
                    {
                        message = "پیش‌نویس تغییر کرده یا نوع متقاضی با این فرم سازگار نیست."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMyLegalSellerIdentity")
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

    private static string? MaskNationalCode(string? value) =>
        value is { Length: 10 }
            ? "******" + value[^4..]
            : null;

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

internal sealed record SellerNaturalIdentityInput(
    string? NationalCode,
    int Revision);

internal sealed record SellerLegalIdentityInput(
    string? LegalNationalId,
    string? LegalName,
    string? RepresentativeName,
    string? RepresentativePhone,
    int Revision);

internal sealed record SellerRegistrationSubmitInput(int Revision);
