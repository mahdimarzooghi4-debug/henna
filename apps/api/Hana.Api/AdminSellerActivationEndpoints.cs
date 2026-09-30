using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class AdminSellerActivationEndpoints
{
    internal static void MapAdminSellerActivation(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapPost("/api/v1/admin/seller-applications/{applicationId:guid}/activate",
            async (
                Guid applicationId,
                AdminSellerActivationInput input,
                HttpContext context,
                IServiceProvider services,
                CancellationToken cancellationToken) =>
            {
                context.Response.Headers.CacheControl = "no-store";
                if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);

                var adminId = await AuthorizeAdminAsync(
                    context, services, hasDatabase, cancellationToken);
                if (adminId.Error is not null) return adminId.Error;
                if (adminId.AccountId is null)
                    return Results.StatusCode(
                        StatusCodes.Status403Forbidden);

                if (input.Revision < 1 || input.Revision == int.MaxValue)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["revision"] = ["نسخه پرونده معتبر نیست."]
                        });

                var keyHeader =
                    context.Request.Headers["Idempotency-Key"].ToString();
                if (!Guid.TryParse(keyHeader, out var activationKey) ||
                    activationKey == Guid.Empty)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["idempotencyKey"] =
                                ["کلید فعال‌سازی معتبر نیست."]
                        });

                try
                {
                    var db = services
                        .GetRequiredService<HanaSellerDbContext>();

                    var existing = await db.SellerActivations
                        .AsNoTracking()
                        .SingleOrDefaultAsync(
                            x => x.ActivationKey == activationKey,
                            cancellationToken);
                    if (existing is not null)
                    {
                        if (existing.ApplicationAccountId != applicationId ||
                            existing.ExpectedRevision != input.Revision ||
                            existing.ActivatedByAccountId !=
                                adminId.AccountId.Value)
                            return Results.Conflict(new
                            {
                                message =
                                    "کلید فعال‌سازی قبلاً برای درخواست دیگری استفاده شده است."
                            });

                        var replay = await db.RegistrationDrafts
                            .AsNoTracking()
                            .SingleOrDefaultAsync(
                                x => x.AccountId == applicationId,
                                cancellationToken);
                        return replay is null
                            ? Results.NotFound()
                            : Results.Ok(ActivationResponse(replay));
                    }

                    if (await db.SellerActivations.AsNoTracking()
                        .AnyAsync(
                            x => x.ApplicationAccountId == applicationId,
                            cancellationToken))
                        return Results.Conflict(new
                        {
                            message =
                                "این پرونده قبلاً با کلید دیگری فعال شده است."
                        });

                    await using var transaction = await db.Database
                        .BeginTransactionAsync(cancellationToken);
                    var now = services.GetRequiredService<IClock>().UtcNow
                        .ToUniversalTime();

                    var updated = await db.RegistrationDrafts
                        .Where(x => x.AccountId == applicationId &&
                            x.Status == "SUBMITTED" &&
                            x.ReviewStatus == "APPROVED" &&
                            x.ActivatedAtUtc == null &&
                            x.ActivatedByAccountId == null &&
                            x.Revision == input.Revision &&
                            !db.ApplicationAmendments.Any(amendment =>
                                amendment.ApplicationAccountId == x.AccountId &&
                                amendment.Status == "OPEN"))
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(x => x.ActivatedAtUtc, now)
                            .SetProperty(x => x.ActivatedByAccountId,
                                adminId.AccountId.Value)
                            .SetProperty(x => x.Revision,
                                input.Revision + 1)
                            .SetProperty(x => x.UpdatedAtUtc, now),
                            cancellationToken);

                    if (updated != 1)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        var current = await db.RegistrationDrafts
                            .AsNoTracking()
                            .SingleOrDefaultAsync(
                                x => x.AccountId == applicationId,
                                cancellationToken);
                        return current is null
                            ? Results.NotFound()
                            : Results.Conflict(new
                            {
                                message =
                                    "پرونده تأیید نشده، تغییر کرده یا قبلاً فعال شده است.",
                                currentRevision = current.Revision,
                                reviewStatus = current.ReviewStatus,
                                activatedAtUtc = current.ActivatedAtUtc
                            });
                    }

                    // Identity and Seller share the same PostgreSQL database.
                    // Keep the role grant in this Seller transaction so a
                    // committed activation can never exist without SELLER RBAC.
                    await db.Database.ExecuteSqlInterpolatedAsync($"""
                        INSERT INTO identity.role_assignments
                          (account_id, role, granted_at_utc)
                        VALUES ({applicationId}, {HanaRoles.Seller}, {now})
                        ON CONFLICT (account_id, role) DO NOTHING
                        """, cancellationToken);

                    db.SellerActivations.Add(new SellerActivationRecord
                    {
                        Id = Guid.NewGuid(),
                        ApplicationAccountId = applicationId,
                        ActivatedByAccountId = adminId.AccountId.Value,
                        ActivationKey = activationKey,
                        ExpectedRevision = input.Revision,
                        CreatedAtUtc = now
                    });
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);

                    var activated = await db.RegistrationDrafts
                        .AsNoTracking()
                        .SingleAsync(
                            x => x.AccountId == applicationId,
                            cancellationToken);
                    return Results.Ok(ActivationResponse(activated));
                }
                catch (Exception) when (
                    !cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            })
            .WithName("ActivateApprovedSellerApplication")
            .WithTags("Admin")
            .ProducesValidationProblem();
    }

    private static async Task<(Guid? AccountId, IResult? Error)>
        AuthorizeAdminAsync(
            HttpContext context,
            IServiceProvider services,
            bool hasDatabase,
            CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase)
            return (null,
                Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable));

        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(
            token, cancellationToken);
        if (accountId is null)
            return (null, Results.Unauthorized());

        var roles = services.GetRequiredService<RoleAuthorizationService>();
        if (!await roles.HasRoleAsync(
            accountId.Value, HanaRoles.Admin, cancellationToken))
            return (null,
                Results.StatusCode(StatusCodes.Status403Forbidden));

        return (accountId, null);
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ",
            StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _)
            ? token
            : null;
    }

    private static object ActivationResponse(
        SellerRegistrationDraft application) => new
        {
            applicationId = application.AccountId,
            application.Revision,
            application.TrackingCode,
            application.ReviewStatus,
            application.ActivatedAtUtc,
            sellerRoleGranted = application.ActivatedAtUtc is not null,
            sellerAccessEnabled = application.ActivatedAtUtc is not null,
            sellerPanelEnabled = false
        };
}

internal sealed record AdminSellerActivationInput(int Revision);
