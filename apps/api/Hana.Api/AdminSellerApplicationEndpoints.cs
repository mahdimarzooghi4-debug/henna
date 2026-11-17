using Hana.Application.Time;
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
            string? reviewStatus,
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
            var requestedReviewStatus = reviewStatus?.Trim().ToUpperInvariant();
            if (requestedPage < 1 || requestedPage > 10_000 ||
                requestedPageSize < 1 || requestedPageSize > 50 ||
                (requestedReviewStatus is not null &&
                    requestedReviewStatus is not ("ALL" or "UNDER_REVIEW" or
                        "NEEDS_INFORMATION" or "APPROVED" or "REJECTED")))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [requestedReviewStatus is not null &&
                        requestedReviewStatus is not ("ALL" or "UNDER_REVIEW" or
                            "NEEDS_INFORMATION" or "APPROVED" or "REJECTED")
                        ? "reviewStatus" : "pagination"] =
                        ["فیلتر یا صفحه‌بندی معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var query = db.RegistrationDrafts.AsNoTracking()
                    .Where(x => x.Status == "SUBMITTED");
                if (requestedReviewStatus is not null and not "ALL")
                    query = query.Where(x => x.ReviewStatus == requestedReviewStatus);
                query = query
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
                        x.TrackingCode,
                        x.ReviewStatus,
                        x.ReviewedAtUtc,
                        x.ActivatedAtUtc,
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

                var reviewHistory = await db.ApplicationReviews.AsNoTracking()
                    .Where(x => x.ApplicationAccountId == applicationId)
                    .OrderBy(x => x.CreatedAtUtc)
                    .ThenBy(x => x.Id)
                    .Select(x => new
                    {
                        x.ExpectedRevision,
                        x.Decision,
                        x.Reason,
                        x.CreatedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    applicationId = application.AccountId,
                    application.StoreName,
                    application.OwnerName,
                    application.ApplicantType,
                    application.IdentityStatus,
                    nationalCodeMasked = MaskNationalCode(
                        application.NaturalNationalCode),
                    legalNationalIdMasked = MaskLegalNationalId(
                        application.LegalNationalId),
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
                    application.RegistrationContactName,
                    application.RegistrationContactRole,
                    backupPhoneMasked = MaskOptionalPhone(application.BackupPhone),
                    application.WebsiteOrSocial,
                    application.BusinessEmail,
                    application.ResponseHours,
                    documentsRequired = false,
                    phoneMasked = MaskPhone(application.Phone),
                    application.City,
                    application.Address,
                    application.PostalCode,
                    application.Status,
                    application.Revision,
                    application.TrackingCode,
                    application.ReviewStatus,
                    application.ReviewReason,
                    application.ReviewedAtUtc,
                    application.ActivatedAtUtc,
                    application.ActivatedByAccountId,
                    application.SubmittedAtUtc,
                    reviewHistory
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetSubmittedSellerApplication");

        routes.MapPost("/{applicationId:guid}/review", async (
            Guid applicationId,
            AdminSellerReviewInput input,
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
            if (auth.AccountId is null)
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["revision"] = ["نسخه پرونده معتبر نیست."]
                });

            if (!TryDecision(input.Decision, out var decision))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["decision"] = ["نتیجه بررسی معتبر نیست."]
                });

            var reason = CleanReason(input.Reason);
            if ((decision is "NEEDS_INFORMATION" or "REJECTED") &&
                reason is null)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["reason"] = ["برای این نتیجه، دلیل بررسی الزامی است."]
                });
            if (input.Reason is not null && reason is null)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["reason"] = ["متن دلیل بررسی معتبر نیست."]
                });

            var keyHeader = context.Request.Headers["Idempotency-Key"].ToString();
            if (!Guid.TryParse(keyHeader, out var decisionKey) ||
                decisionKey == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["idempotencyKey"] = ["کلید ثبت تصمیم معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var existing = await db.ApplicationReviews.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.DecisionKey == decisionKey,
                        cancellationToken);
                if (existing is not null)
                {
                    if (existing.ApplicationAccountId != applicationId ||
                        existing.ExpectedRevision != input.Revision ||
                        existing.Decision != decision ||
                        existing.Reason != reason ||
                        existing.ReviewerAccountId != auth.AccountId.Value)
                        return Results.Conflict(new
                        {
                            message = "کلید تصمیم قبلاً برای درخواست دیگری استفاده شده است."
                        });

                    var replay = await db.RegistrationDrafts.AsNoTracking()
                        .SingleOrDefaultAsync(x => x.AccountId == applicationId,
                            cancellationToken);
                    if (replay is null) return Results.NotFound();
                    return Results.Ok(ReviewResponse(replay));
                }

                await using var transaction = await db.Database
                    .BeginTransactionAsync(cancellationToken);
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();

                var updated = await db.RegistrationDrafts
                    .Where(x => x.AccountId == applicationId &&
                        x.Status == "SUBMITTED" &&
                        x.ReviewStatus == "UNDER_REVIEW" &&
                        x.Revision == input.Revision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.ReviewStatus, decision)
                        .SetProperty(x => x.ReviewReason, reason)
                        .SetProperty(x => x.ReviewedByAccountId,
                            auth.AccountId.Value)
                        .SetProperty(x => x.ReviewedAtUtc, now)
                        .SetProperty(x => x.Revision, input.Revision + 1)
                        .SetProperty(x => x.UpdatedAtUtc, now),
                        cancellationToken);

                if (updated != 1)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    var current = await db.RegistrationDrafts.AsNoTracking()
                        .SingleOrDefaultAsync(x => x.AccountId == applicationId,
                            cancellationToken);
                    return current is null
                        ? Results.NotFound()
                        : Results.Conflict(new
                        {
                            message =
                                "پرونده تغییر کرده یا قبلاً بررسی شده است.",
                            currentRevision = current.Revision,
                            reviewStatus = current.ReviewStatus
                        });
                }

                db.ApplicationReviews.Add(new SellerApplicationReviewRecord
                {
                    Id = Guid.NewGuid(),
                    ApplicationAccountId = applicationId,
                    ReviewerAccountId = auth.AccountId.Value,
                    DecisionKey = decisionKey,
                    ExpectedRevision = input.Revision,
                    Decision = decision,
                    Reason = reason,
                    CreatedAtUtc = now
                });
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                var currentRow = await db.RegistrationDrafts.AsNoTracking()
                    .SingleAsync(x => x.AccountId == applicationId,
                        cancellationToken);
                return Results.Ok(ReviewResponse(currentRow));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("ReviewSubmittedSellerApplication")
        .ProducesValidationProblem();

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

    private static string? MaskLegalNationalId(string? nationalId) =>
        nationalId is { Length: 10 or 11 }
            ? new string('*', nationalId.Length - 4) + nationalId[^4..]
            : null;

    private static bool TryDecision(string? value, out string decision)
    {
        decision = value?.Trim().ToUpperInvariant() ?? "";
        return decision is "NEEDS_INFORMATION" or "APPROVED" or "REJECTED";
    }

    private static string? CleanReason(string? value)
    {
        if (value is null) return null;
        var cleaned = value.Trim();
        if (cleaned.Length == 0) return null;
        if (cleaned.Length > 500 || cleaned.Any(char.IsControl))
            return null;
        return cleaned;
    }

    private static object ReviewResponse(SellerRegistrationDraft application) =>
        new
        {
            applicationId = application.AccountId,
            application.Status,
            application.Revision,
            application.TrackingCode,
            application.ReviewStatus,
            application.ReviewReason,
            application.ReviewedAtUtc,
            sellerActivated = false
        };
}

internal sealed record AdminSellerReviewInput(
    int Revision,
    string? Decision,
    string? Reason);
