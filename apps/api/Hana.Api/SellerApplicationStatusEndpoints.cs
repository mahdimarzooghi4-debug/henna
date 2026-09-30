using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class SellerApplicationStatusEndpoints
{
    internal static void MapSellerApplicationStatus(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapGet("/api/v1/seller/registration/status", async (
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
                var accountId = await services
                    .GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var draft = await db.RegistrationDrafts.AsNoTracking()
                    .Where(x => x.AccountId == accountId.Value)
                    .Select(x => new
                    {
                        x.ApplicantType,
                        x.IdentityStatus,
                        x.Status,
                        x.CompletedStep,
                        x.TrackingCode,
                        x.SubmittedAtUtc,
                        x.AccuracyConfirmedAtUtc
                    })
                    .SingleOrDefaultAsync(cancellationToken);

                if (draft is null) return Results.NotFound();

                if (draft.Status != "SUBMITTED" ||
                    draft.CompletedStep != 6 ||
                    draft.TrackingCode is null ||
                    draft.SubmittedAtUtc is null ||
                    draft.AccuracyConfirmedAtUtc is null)
                    return Results.Conflict(new
                    {
                        status = "DRAFT",
                        completedStep = draft.CompletedStep,
                        message =
                            "وضعیت پیگیری پس از ثبت نهایی درخواست در دسترس است."
                    });

                return Results.Ok(new
                {
                    trackingCode = draft.TrackingCode,
                    overallStatus = "UNDER_REVIEW",
                    applicantType = draft.ApplicantType,
                    identityStatus = draft.IdentityStatus,
                    submittedAtUtc = draft.SubmittedAtUtc,
                    accuracyConfirmedAtUtc = draft.AccuracyConfirmedAtUtc,
                    sellerPanelEnabled = false,
                    steps = new[]
                    {
                        new { key = "IDENTITY", status = "COMPLETED" },
                        new { key = "BUSINESS", status = "COMPLETED" },
                        new { key = "ACTIVITY", status = "COMPLETED" },
                        new { key = "ADDITIONAL", status = "COMPLETED" },
                        new { key = "REVIEW", status = "UNDER_REVIEW" }
                    }
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetMySellerApplicationStatus")
        .WithTags("Seller");
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
