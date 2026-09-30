using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerApplicationAmendmentEndpoints
{
    internal static void MapSellerApplicationAmendments(
        this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/registration/amendment")
            .WithTags("Seller");

        routes.MapGet("", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var accountId = await AccountAsync(
                context, app, services, hasDatabase, cancellationToken);
            if (accountId.Error is not null) return accountId.Error;

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var application = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.AccountId == accountId.Id!.Value,
                        cancellationToken);
                if (application is null) return Results.NotFound();
                if (application.Status != "SUBMITTED" ||
                    application.ReviewStatus != "NEEDS_INFORMATION" ||
                    application.ReviewReason is null)
                    return Results.Conflict(new
                    {
                        message = "پرونده در وضعیت نیازمند تکمیل اطلاعات نیست."
                    });

                var amendment = await db.ApplicationAmendments.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.ApplicationAccountId == application.AccountId &&
                            x.Status == "OPEN",
                        cancellationToken);

                return Results.Ok(new
                {
                    application.TrackingCode,
                    application.Revision,
                    reviewerReason = application.ReviewReason,
                    amendment = amendment is null ? null : new
                    {
                        amendment.Id,
                        amendment.BaseRevision,
                        amendment.ResponseText,
                        amendment.ReferenceUrl,
                        amendment.UpdatedAtUtc
                    }
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetMySellerApplicationAmendment");

        routes.MapPut("", async (
            SellerAmendmentInput input,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var accountId = await AccountAsync(
                context, app, services, hasDatabase, cancellationToken);
            if (accountId.Error is not null) return accountId.Error;

            var responseText = Clean(input.ResponseText, 2000);
            var referenceUrl = CleanUrl(input.ReferenceUrl);
            if (responseText is null ||
                (input.ReferenceUrl is not null &&
                    input.ReferenceUrl.Trim().Length > 0 &&
                    referenceUrl is null))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["amendment"] = ["پاسخ اصلاحی یا لینک مرجع معتبر نیست."]
                });
            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["revision"] = ["نسخه پرونده معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var application = await db.RegistrationDrafts.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x => x.AccountId == accountId.Id!.Value,
                        cancellationToken);
                if (application is null) return Results.NotFound();
                if (application.Status != "SUBMITTED" ||
                    application.ReviewStatus != "NEEDS_INFORMATION" ||
                    application.ReviewReason is null ||
                    application.Revision != input.Revision)
                    return Results.Conflict(new
                    {
                        message = "پرونده تغییر کرده یا دیگر قابل تکمیل نیست.",
                        currentRevision = application.Revision,
                        reviewStatus = application.ReviewStatus
                    });

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                var open = await db.ApplicationAmendments
                    .SingleOrDefaultAsync(
                        x => x.ApplicationAccountId == application.AccountId &&
                            x.Status == "OPEN",
                        cancellationToken);

                if (open is null)
                {
                    open = new SellerApplicationAmendmentRecord
                    {
                        Id = Guid.NewGuid(),
                        ApplicationAccountId = application.AccountId,
                        BaseRevision = application.Revision,
                        Status = "OPEN",
                        ReviewerReason = application.ReviewReason,
                        ResponseText = responseText,
                        ReferenceUrl = referenceUrl,
                        CreatedAtUtc = now,
                        UpdatedAtUtc = now
                    };
                    db.ApplicationAmendments.Add(open);
                }
                else
                {
                    if (open.BaseRevision != application.Revision ||
                        open.ReviewerReason != application.ReviewReason)
                        return Results.Conflict(new
                        {
                            message = "نسخه amendment با پرونده فعلی سازگار نیست."
                        });
                    open.ResponseText = responseText;
                    open.ReferenceUrl = referenceUrl;
                    open.UpdatedAtUtc = now;
                }

                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(new
                {
                    amendmentId = open.Id,
                    open.BaseRevision,
                    open.ResponseText,
                    open.ReferenceUrl,
                    open.UpdatedAtUtc
                });
            }
            catch (DbUpdateException)
            {
                return Results.Conflict(new
                {
                    message = "یک amendment باز برای این پرونده وجود دارد."
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerApplicationAmendment")
        .ProducesValidationProblem();

        routes.MapPost("/resubmit", async (
            SellerAmendmentResubmitInput input,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var accountId = await AccountAsync(
                context, app, services, hasDatabase, cancellationToken);
            if (accountId.Error is not null) return accountId.Error;
            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["revision"] = ["نسخه پرونده معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                await using var transaction = await db.Database
                    .BeginTransactionAsync(cancellationToken);

                var application = await db.RegistrationDrafts
                    .SingleOrDefaultAsync(
                        x => x.AccountId == accountId.Id!.Value,
                        cancellationToken);
                if (application is null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return Results.NotFound();
                }

                var amendment = await db.ApplicationAmendments
                    .SingleOrDefaultAsync(
                        x => x.Id == input.AmendmentId &&
                            x.ApplicationAccountId == application.AccountId &&
                            x.Status == "OPEN",
                        cancellationToken);

                if (application.Status != "SUBMITTED" ||
                    application.ReviewStatus != "NEEDS_INFORMATION" ||
                    application.Revision != input.Revision ||
                    amendment is null ||
                    amendment.BaseRevision != input.Revision)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return Results.Conflict(new
                    {
                        message = "پرونده یا amendment تغییر کرده و قابل ارسال مجدد نیست.",
                        currentRevision = application.Revision,
                        reviewStatus = application.ReviewStatus
                    });
                }

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                application.ReviewStatus = "UNDER_REVIEW";
                application.ReviewReason = null;
                application.ReviewedByAccountId = null;
                application.ReviewedAtUtc = null;
                application.Revision += 1;
                application.UpdatedAtUtc = now;

                amendment.Status = "RESUBMITTED";
                amendment.ResubmittedAtUtc = now;
                amendment.UpdatedAtUtc = now;

                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Results.Ok(new
                {
                    application.TrackingCode,
                    application.Revision,
                    reviewStatus = application.ReviewStatus,
                    resubmittedAtUtc = now,
                    sellerPanelEnabled = false
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("ResubmitMySellerApplicationAmendment")
        .ProducesValidationProblem();
    }

    private static async Task<(Guid? Id, IResult? Error)> AccountAsync(
        HttpContext context,
        WebApplication app,
        IServiceProvider services,
        bool hasDatabase,
        CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
            return (null,
                Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase)
            return (null,
                Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        var accountId = await services.GetRequiredService<AuthSessionService>()
            .ResolveAccountAsync(token, cancellationToken);
        return accountId is null
            ? (null, Results.Unauthorized())
            : (accountId.Value, null);
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _) ? token : null;
    }

    private static string? Clean(string? value, int maxLength)
    {
        if (value is null) return null;
        var cleaned = value.Trim();
        if (cleaned.Length == 0 || cleaned.Length > maxLength ||
            cleaned.Any(char.IsControl))
            return null;
        return cleaned;
    }

    private static string? CleanUrl(string? value)
    {
        if (value is null || value.Trim().Length == 0) return null;
        var cleaned = value.Trim();
        if (cleaned.Length > 500 ||
            !Uri.TryCreate(cleaned, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps &&
                uri.Scheme != Uri.UriSchemeHttp))
            return null;
        return uri.ToString();
    }
}

internal sealed record SellerAmendmentInput(
    int Revision,
    string? ResponseText,
    string? ReferenceUrl);

internal sealed record SellerAmendmentResubmitInput(
    Guid AmendmentId,
    int Revision);
