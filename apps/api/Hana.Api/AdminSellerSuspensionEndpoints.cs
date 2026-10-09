using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class AdminSellerSuspensionEndpoints
{
    internal static void MapAdminSellerSuspensions(
        this WebApplication app,
        bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/admin/seller-applications")
            .WithTags("Admin");

        routes.MapPost("/{applicationId:guid}/suspend", async (
            Guid applicationId,
            AdminSellerSuspensionInput input,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var auth = await AuthorizeAdminAsync(
                context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Invalid("revision", "نسخه پرونده معتبر نیست.");
            var reason = CleanReason(input.Reason);
            if (reason is null)
                return Invalid("reason", "دلیل تعلیق الزامی است.");
            if (!TryKey(context, out var key))
                return Invalid("idempotencyKey", "کلید تعلیق معتبر نیست.");

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var prior = await db.SellerSuspensions.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.SuspensionKey == key,
                        cancellationToken);
                if (prior is not null)
                {
                    if (prior.ApplicationAccountId != applicationId ||
                        prior.SuspendedByAccountId != auth.AccountId ||
                        prior.ExpectedRevision != input.Revision ||
                        prior.Reason != reason)
                        return Results.Conflict(new
                        {
                            message = "کلید تعلیق قبلاً برای عملیات دیگری استفاده شده است."
                        });
                    return await CurrentResponse(
                        db, applicationId, cancellationToken);
                }

                await using var tx = await db.Database
                    .BeginTransactionAsync(cancellationToken);
                var current = await db.RegistrationDrafts
                    .SingleOrDefaultAsync(x => x.AccountId == applicationId,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                if (current.ActivatedAtUtc is null ||
                    current.Revision != input.Revision ||
                    await db.SellerSuspensions.AnyAsync(x =>
                        x.ApplicationAccountId == applicationId &&
                        x.RestoredAtUtc == null, cancellationToken))
                {
                    await tx.RollbackAsync(cancellationToken);
                    return Results.Conflict(new
                    {
                        message = "فروشنده فعال نیست، نسخه تغییر کرده یا قبلاً تعلیق شده است.",
                        currentRevision = current.Revision
                    });
                }

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                db.SellerSuspensions.Add(new SellerSuspensionRecord
                {
                    Id = Guid.NewGuid(),
                    ApplicationAccountId = applicationId,
                    SuspendedByAccountId = auth.AccountId!.Value,
                    SuspensionKey = key,
                    ExpectedRevision = input.Revision,
                    Reason = reason,
                    CreatedAtUtc = now
                });
                current.Revision = checked(current.Revision + 1);
                current.UpdatedAtUtc = now;

                // Identity and Seller share one PostgreSQL database. Remove
                // the role in the same transaction; the suspension row remains
                // an independent deny boundary even if RBAC is later mis-granted.
                await db.Database.ExecuteSqlInterpolatedAsync($"""
                    DELETE FROM identity.role_assignments
                    WHERE account_id = {applicationId}
                      AND role = {HanaRoles.Seller}
                    """, cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                return await CurrentResponse(
                    db, applicationId, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("SuspendActivatedSeller")
        .ProducesValidationProblem();

        routes.MapPost("/{applicationId:guid}/restore", async (
            Guid applicationId,
            AdminSellerRestoreInput input,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var auth = await AuthorizeAdminAsync(
                context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (input.Revision < 1 || input.Revision == int.MaxValue)
                return Invalid("revision", "نسخه پرونده معتبر نیست.");
            if (!TryKey(context, out var key))
                return Invalid("idempotencyKey", "کلید بازگردانی معتبر نیست.");

            try
            {
                var db = services.GetRequiredService<HanaSellerDbContext>();
                var prior = await db.SellerSuspensions.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.RestoreKey == key,
                        cancellationToken);
                if (prior is not null)
                {
                    if (prior.ApplicationAccountId != applicationId ||
                        prior.RestoredByAccountId != auth.AccountId ||
                        prior.RestoreExpectedRevision != input.Revision)
                        return Results.Conflict(new
                        {
                            message = "کلید بازگردانی قبلاً برای عملیات دیگری استفاده شده است."
                        });
                    return await CurrentResponse(
                        db, applicationId, cancellationToken);
                }

                await using var tx = await db.Database
                    .BeginTransactionAsync(cancellationToken);
                var current = await db.RegistrationDrafts
                    .SingleOrDefaultAsync(x => x.AccountId == applicationId,
                        cancellationToken);
                if (current is null) return Results.NotFound();
                var suspension = await db.SellerSuspensions
                    .SingleOrDefaultAsync(x =>
                        x.ApplicationAccountId == applicationId &&
                        x.RestoredAtUtc == null, cancellationToken);
                if (current.ActivatedAtUtc is null ||
                    current.Revision != input.Revision ||
                    suspension is null)
                {
                    await tx.RollbackAsync(cancellationToken);
                    return Results.Conflict(new
                    {
                        message = "تعلیق باز وجود ندارد یا نسخه پرونده تغییر کرده است.",
                        currentRevision = current.Revision
                    });
                }

                var now = services.GetRequiredService<IClock>().UtcNow
                    .ToUniversalTime();
                suspension.RestoredAtUtc = now;
                suspension.RestoredByAccountId = auth.AccountId!.Value;
                suspension.RestoreKey = key;
                suspension.RestoreExpectedRevision = input.Revision;
                current.Revision = checked(current.Revision + 1);
                current.UpdatedAtUtc = now;

                await db.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO identity.role_assignments
                      (account_id, role, granted_at_utc)
                    VALUES ({applicationId}, {HanaRoles.Seller}, {now})
                    ON CONFLICT (account_id, role) DO NOTHING
                    """, cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                return await CurrentResponse(
                    db, applicationId, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("RestoreSuspendedSeller")
        .ProducesValidationProblem();
    }

    private static async Task<IResult> CurrentResponse(
        HanaSellerDbContext db,
        Guid applicationId,
        CancellationToken cancellationToken)
    {
        var application = await db.RegistrationDrafts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.AccountId == applicationId,
                cancellationToken);
        if (application is null) return Results.NotFound();
        var suspension = await db.SellerSuspensions.AsNoTracking()
            .Where(x => x.ApplicationAccountId == applicationId &&
                x.RestoredAtUtc == null)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var suspended = suspension is not null;
        return Results.Ok(new
        {
            applicationId,
            application.Revision,
            application.ReviewStatus,
            application.ReviewReason,
            application.ActivatedAtUtc,
            sellerActivated = application.ActivatedAtUtc is not null,
            sellerSuspended = suspended,
            suspendedAtUtc = suspension?.CreatedAtUtc,
            suspensionReason = suspension?.Reason,
            sellerRoleGranted = application.ActivatedAtUtc is not null && !suspended,
            sellerAccessEnabled = application.ActivatedAtUtc is not null && !suspended,
            sellerPanelEnabled = application.ActivatedAtUtc is not null && !suspended
        });
    }

    private static IResult Invalid(string key, string message) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]> { [key] = [message] });

    private static string? CleanReason(string? value)
    {
        var reason = value?.Trim();
        return !string.IsNullOrWhiteSpace(reason) &&
            reason.Length <= 500 &&
            !reason.Any(char.IsControl) ? reason : null;
    }

    private static bool TryKey(HttpContext context, out Guid key) =>
        Guid.TryParse(
            context.Request.Headers["Idempotency-Key"].ToString(), out key) &&
        key != Guid.Empty;

    private static async Task<(Guid? AccountId, IResult? Error)>
        AuthorizeAdminAsync(
            HttpContext context,
            IServiceProvider services,
            bool hasDatabase,
            CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps &&
            !context.RequestServices
                .GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ",
                StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(header[7..], out _))
            return (null, Results.Unauthorized());
        if (!hasDatabase)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        var accountId = await services.GetRequiredService<AuthSessionService>()
            .ResolveAccountAsync(header[7..], cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        if (!await services.GetRequiredService<RoleAuthorizationService>()
            .HasRoleAsync(accountId.Value, HanaRoles.Admin,
                cancellationToken))
            return (null, Results.StatusCode(StatusCodes.Status403Forbidden));
        return (accountId, null);
    }
}

internal sealed record AdminSellerSuspensionInput(int Revision, string? Reason);
internal sealed record AdminSellerRestoreInput(int Revision);
