using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Hana.Application.Time;
using Hana.Domain.Seller;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Hana.Api;

/// <summary>
/// Account-free public application intake. Deliberately separate from the
/// account-bound, identity-verified seller registration/activation aggregate.
/// No endpoint here grants Seller access or evaluates eligibility.
/// </summary>
internal static class PublicSellerIntakeEndpoints
{
    private const string TokenHeader = "X-Hana-Seller-Intake-Token";
    private static readonly Regex TokenPattern = new(
        "^[0-9A-F]{64}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    internal static void MapPublicSellerIntake(this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/seller/public-registration")
            .WithTags("Seller Public Intake");

        routes.MapPost("", async (PublicSellerIntakeInput input,
            HttpContext context, IServiceProvider services, CancellationToken ct) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(503);
            if (!hasDatabase) return Results.StatusCode(503);
            var token = context.Request.Headers[TokenHeader].ToString();
            if (!TokenPattern.IsMatch(token))
                return Results.BadRequest(new { message = "شناسهٔ محرمانه درخواست معتبر نیست." });
            if (!Valid(input, out var normalized))
                return Results.BadRequest(new { message = "اطلاعات درخواست ناقص یا نامعتبر است." });

            var credentialDigest = Convert.ToHexString(SHA256.HashData(Convert.FromHexString(token)));
            var json = JsonSerializer.Serialize(normalized);
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
            var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
            var tracking = "HNA-P-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8));

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                await db.Database.OpenConnectionAsync(ct);
                // Same browser secret acts as an idempotent submission credential.
                // A changed body with that secret conflicts; it cannot replace a
                // previously received application or create a seller profile.
                await using (var insert = new NpgsqlCommand("""
                    INSERT INTO seller.public_registration_intakes
                      (id, credential_digest, payload_sha256, payload_json,
                       tracking_code, status, submitted_at_utc)
                    VALUES (@id, @credential, @hash, @payload,
                            @tracking, 'RECEIVED', @submitted)
                    ON CONFLICT (credential_digest) DO NOTHING
                    """, (NpgsqlConnection)db.Database.GetDbConnection()))
                {
                    insert.Parameters.AddWithValue("id", Guid.NewGuid());
                    insert.Parameters.AddWithValue("credential", credentialDigest);
                    insert.Parameters.AddWithValue("hash", hash);
                    insert.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, json);
                    insert.Parameters.AddWithValue("tracking", tracking);
                    insert.Parameters.AddWithValue("submitted", now);
                    await insert.ExecuteNonQueryAsync(ct);
                }

                await using var read = new NpgsqlCommand("""
                    SELECT tracking_code, payload_sha256, submitted_at_utc
                    FROM seller.public_registration_intakes
                    WHERE credential_digest = @credential
                    """, (NpgsqlConnection)db.Database.GetDbConnection());
                read.Parameters.AddWithValue("credential", credentialDigest);
                await using var reader = await read.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct))
                    return Results.StatusCode(503);
                var existingTracking = reader.GetString(0);
                var existingHash = reader.GetString(1);
                var submitted = reader.GetFieldValue<DateTimeOffset>(2);
                if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(existingHash), Convert.FromHexString(hash)))
                    return Results.Conflict(new {
                        message = "برای این مرورگر قبلاً درخواست متفاوتی ثبت شده است."
                    });
                return Results.Ok(new {
                    status = "RECEIVED", trackingCode = existingTracking,
                    submittedAtUtc = submitted,
                    message = "درخواست همکاری دریافت شد؛ هنوز تأیید یا فعال‌سازی فروشگاه انجام نشده است."
                });
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                return Results.StatusCode(503);
            }
        }).WithName("SubmitPublicSellerIntake")
          .RequireRateLimiting("public-seller-intake")
          .DisableAntiforgery()
          .Produces(StatusCodes.Status429TooManyRequests);

        routes.MapGet("/status", async (HttpContext context,
            IServiceProvider services, CancellationToken ct) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(503);
            if (!hasDatabase) return Results.StatusCode(503);
            var token = context.Request.Headers[TokenHeader].ToString();
            if (!TokenPattern.IsMatch(token)) return Results.Unauthorized();
            var digest = Convert.ToHexString(SHA256.HashData(Convert.FromHexString(token)));
            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                await db.Database.OpenConnectionAsync(ct);
                await using var command = new NpgsqlCommand("""
                    SELECT tracking_code, status, submitted_at_utc
                    FROM seller.public_registration_intakes
                    WHERE credential_digest = @credential
                    """, (NpgsqlConnection)db.Database.GetDbConnection());
                command.Parameters.AddWithValue("credential", digest);
                await using var reader = await command.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct)) return Results.NotFound();
                return Results.Ok(new {
                    trackingCode = reader.GetString(0),
                    status = reader.GetString(1),
                    submittedAtUtc = reader.GetFieldValue<DateTimeOffset>(2),
                });
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                return Results.StatusCode(503);
            }
        }).WithName("GetMyPublicSellerIntakeStatus");
    }

    private static bool Valid(PublicSellerIntakeInput input, out object? normalized)
    {
        normalized = null;
        if (!SellerRegistrationFields.TryCreate(input.StoreName,
            input.OwnerName, input.Phone, input.City, input.Address,
            input.PostalCode, out var fields) ||
            fields is null || input.Confirmed != true ||
            input.ApplicantType is not ("NATURAL" or "LEGAL") ||
            input.OfferingType != "GOOD" ||
            !ValidText(input.BusinessName, 180) ||
            !ValidText(input.BusinessDescription, 500) ||
            !ValidText(input.ActivityAddress, 500) ||
            !ValidText(input.ActivityHours, 180) ||
            !ValidText(input.ServiceArea, 240) ||
            !ValidText(input.RegistrationContactName, 120) ||
            !ValidText(input.ResponseHours, 180) ||
            !ValidOptional(input.RegistrationContactRole, 120) ||
            !ValidOptional(input.BackupPhone, 11) ||
            !ValidOptional(input.WebsiteOrSocial, 300) ||
            !ValidOptional(input.BusinessEmail, 254) ||
            (input.BackupPhone is not null &&
             !Regex.IsMatch(input.BackupPhone, "^09[0-9]{9}$")) ||
            (!input.SellerDelivery && !input.Pickup))
            return false;

        normalized = new {
            fields.StoreName, fields.OwnerName, fields.Phone,
            fields.City, fields.Address, fields.PostalCode,
            input.ApplicantType, input.OfferingType,
            BusinessName = input.BusinessName!.Trim(),
            BusinessDescription = input.BusinessDescription!.Trim(),
            ActivityAddress = input.ActivityAddress!.Trim(),
            ActivityHours = input.ActivityHours!.Trim(),
            input.SellerDelivery, input.Pickup,
            ServiceArea = input.ServiceArea!.Trim(),
            RegistrationContactName = input.RegistrationContactName!.Trim(),
            RegistrationContactRole = input.RegistrationContactRole?.Trim(),
            input.BackupPhone, WebsiteOrSocial = input.WebsiteOrSocial?.Trim(),
            BusinessEmail = input.BusinessEmail?.Trim(),
            ResponseHours = input.ResponseHours!.Trim(),
            // An applicant-provided phone or ID is NEVER verified identity.
            identityVerified = false
        };
        return true;
    }

    private static bool ValidText(string? text, int max) =>
        text is not null && text.Trim().Length > 0 &&
        text.Trim().Length <= max && !text.Any(char.IsControl);

    private static bool ValidOptional(string? text, int max) =>
        text is null || text.Length == 0 ||
        (text.Trim().Length > 0 && text.Length <= max && !text.Any(char.IsControl));
}

internal sealed record PublicSellerIntakeInput(
    string? StoreName, string? OwnerName, string? Phone,
    string? City, string? Address, string? PostalCode,
    string? ApplicantType, string? BusinessName,
    string? BusinessDescription, string? OfferingType,
    string? ActivityAddress, string? ActivityHours,
    bool SellerDelivery, bool Pickup, string? ServiceArea,
    string? RegistrationContactName, string? RegistrationContactRole,
    string? BackupPhone, string? WebsiteOrSocial, string? BusinessEmail,
    string? ResponseHours, bool Confirmed);
