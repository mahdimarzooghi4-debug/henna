using System.Net.Mail;
using System.Text.RegularExpressions;
using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static partial class SellerAdditionalInformationEndpoints
{
    [GeneratedRegex("^09[0-9]{9}$", RegexOptions.CultureInvariant)]
    private static partial Regex IranianMobile();

    internal static void MapSellerAdditionalInformation(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapPut("/api/v1/seller/registration/additional-information", async (
            SellerAdditionalInformationInput input,
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

            var contactName = CleanRequired(input.ContactName, 120);
            var contactRole = CleanOptional(input.ContactRole, 120);
            var backupPhone = CleanOptional(input.BackupPhone, 11);
            var websiteOrSocial = CleanOptional(input.WebsiteOrSocial, 300);
            var businessEmail = CleanOptional(input.BusinessEmail, 254);
            var responseHours = CleanRequired(input.ResponseHours, 180);

            if (contactName is null || responseHours is null ||
                (input.ContactRole is not null && contactRole is null) ||
                (input.BackupPhone is not null && backupPhone is null) ||
                (input.WebsiteOrSocial is not null && websiteOrSocial is null) ||
                (input.BusinessEmail is not null && businessEmail is null) ||
                (backupPhone is not null &&
                    !IranianMobile().IsMatch(backupPhone)) ||
                (businessEmail is not null &&
                    !MailAddress.TryCreate(businessEmail, out _)))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["additionalInformation"] =
                            ["اطلاعات تکمیلی کامل یا معتبر نیست."]
                    });

            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services
                    .GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();

                var db = services.GetRequiredService<HanaSellerDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();

                var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE seller.registration_drafts SET
                      registration_contact_name = {contactName},
                      registration_contact_role = {contactRole},
                      backup_phone = {backupPhone},
                      website_or_social = {websiteOrSocial},
                      business_email = {businessEmail},
                      response_hours = {responseHours},
                      completed_step = 6,
                      revision = revision + 1,
                      updated_at_utc = {now}
                    WHERE account_id = {accountId.Value}
                      AND status = 'DRAFT'
                      AND completed_step = 5
                      AND revision = {input.Revision}
                    """, cancellationToken);

                return updated == 1
                    ? Results.Ok(new
                    {
                        status = "DRAFT",
                        revision = input.Revision + 1,
                        completedStep = 6,
                        contactName,
                        contactRole,
                        backupPhone,
                        websiteOrSocial,
                        businessEmail,
                        responseHours,
                        documentsRequired = false
                    })
                    : Results.Conflict(new
                    {
                        message =
                            "پیش‌نویس تغییر کرده یا مرحله اطلاعات تکمیلی دیگر قابل ویرایش نیست."
                    });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SaveMySellerAdditionalInformation")
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

    private static string? CleanRequired(string? value, int maxLength)
    {
        var cleaned = CleanOptional(value, maxLength);
        return cleaned is { Length: > 0 } ? cleaned : null;
    }

    private static string? CleanOptional(string? value, int maxLength)
    {
        if (value is null) return null;
        var cleaned = value.Trim();
        if (cleaned.Length == 0) return null;
        if (cleaned.Length > maxLength || cleaned.Any(char.IsControl))
            return null;
        return cleaned;
    }
}

internal sealed record SellerAdditionalInformationInput(
    string? ContactName,
    string? ContactRole,
    string? BackupPhone,
    string? WebsiteOrSocial,
    string? BusinessEmail,
    string? ResponseHours,
    int Revision);
