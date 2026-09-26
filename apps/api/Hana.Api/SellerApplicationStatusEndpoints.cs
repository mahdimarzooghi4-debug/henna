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
                        x.AccuracyConfirmedAtUtc,
                        x.ReviewStatus,
                        x.ReviewReason,
                        x.ReviewedAtUtc,
                        x.ActivatedAtUtc
                    })
                    .SingleOrDefaultAsync(cancellationToken);

                if (draft is null) return Results.NotFound();

                if (draft.Status != "SUBMITTED" ||
                    draft.CompletedStep != 6 ||
                    draft.TrackingCode is null ||
                    draft.SubmittedAtUtc is null ||
                    draft.AccuracyConfirmedAtUtc is null ||
                    draft.ReviewStatus is null)
                    return Results.Conflict(new
                    {
                        status = "DRAFT",
                        completedStep = draft.CompletedStep,
                        message =
                            "وضعیت پیگیری پس از ثبت نهایی درخواست در دسترس است."
                    });

                var sellerAccessEnabled =
                    draft.ActivatedAtUtc is not null &&
                    await services
                        .GetRequiredService<RoleAuthorizationService>()
                        .HasRoleAsync(
                            accountId.Value,
                            HanaRoles.Seller,
                            cancellationToken);

                return Results.Ok(new
                {
                    trackingCode = draft.TrackingCode,
                    overallStatus = draft.ReviewStatus,
                    applicantType = draft.ApplicantType,
                    identityStatus = draft.IdentityStatus,
                    submittedAtUtc = draft.SubmittedAtUtc,
                    accuracyConfirmedAtUtc = draft.AccuracyConfirmedAtUtc,
                    reviewReason = draft.ReviewReason,
                    reviewedAtUtc = draft.ReviewedAtUtc,
                    activatedAtUtc = draft.ActivatedAtUtc,
                    sellerAccessEnabled,
                    sellerPanelEnabled = false,
                    steps = new[]
                    {
                        new { key = "IDENTITY", status = "COMPLETED" },
                        new { key = "BUSINESS", status = "COMPLETED" },
                        new { key = "ACTIVITY", status = "COMPLETED" },
                        new { key = "ADDITIONAL", status = "COMPLETED" },
                        new { key = "REVIEW", status = draft.ReviewStatus }
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
