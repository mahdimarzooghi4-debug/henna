using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationNotificationsEndpoints
{
    internal static void MapOrganizationNotifications(
        this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/organization/notifications", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";

            if (context.Request.Query.Count != 0)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] = ["این مسیر پارامتر query نمی‌پذیرد."]
                    });

            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var authorization = context.Request.Headers.Authorization.ToString();
            if (!authorization.StartsWith("Bearer ",
                    StringComparison.OrdinalIgnoreCase) ||
                !SessionTokenCodec.TryComputeDigest(authorization[7..], out _))
                return Results.Unauthorized();

            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var sessions = services.GetRequiredService<AuthSessionService>();
                var accessService = services
                    .GetRequiredService<OrganizationAccessService>();
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var accountId = await sessions.ResolveAccountAsync(
                    authorization[7..], cancellationToken);
                if (accountId is null)
                    return Results.Unauthorized();

                var access = await accessService.ResolveAccessAsync(
                    accountId.Value, cancellationToken);
                if (access is null)
                    return Results.StatusCode(StatusCodes.Status403Forbidden);

                // Only the durable DRAFT -> REGISTERED transition is an
                // approved event source. Never infer events from edited dates.
                var account = accountId.Value;
                var events = await db.Programs.AsNoTracking()
                    .Where(program =>
                        program.OrganizationId == access.OrganizationId &&
                        program.RegistrationKey != null &&
                        program.RegisteredAtUtc != null)
                    .OrderByDescending(program => program.RegisteredAtUtc)
                    .ThenByDescending(program => program.Id)
                    .Take(100)
                    .Select(program => new
                    {
                        program.Id,
                        program.RegisteredAtUtc,
                        IsRead = db.NotificationReads.AsNoTracking().Any(read =>
                            read.OrganizationId == access.OrganizationId &&
                            read.ProgramId == program.Id &&
                            read.AccountId == account)
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    notifications = events.Select(item => new
                    {
                        id = item.Id.ToString("D"),
                        type = "PROGRAM_REGISTERED",
                        title = "ثبت طرح سازمانی",
                        message = "یک طرح سازمانی ثبت شد.",
                        createdAtUtc = item.RegisteredAtUtc!.Value
                            .UtcDateTime.ToString("O"),
                        readState = item.IsRead ? "READ" : "UNREAD"
                    }).ToArray()
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetOrganizationNotifications")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        app.MapPost("/api/v1/organization/notifications/{id:guid}/read", async (
            Guid id,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (context.Request.Query.Count != 0 ||
                context.Request.ContentLength is > 0 ||
                context.Request.Headers.ContainsKey("Transfer-Encoding"))
                return Results.BadRequest();
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            var authorization = context.Request.Headers.Authorization.ToString();
            if (!authorization.StartsWith("Bearer ",
                    StringComparison.OrdinalIgnoreCase) ||
                !SessionTokenCodec.TryComputeDigest(authorization[7..], out _))
                return Results.Unauthorized();
            if (!hasDatabase)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            try
            {
                var accountId = await services
                    .GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(authorization[7..], cancellationToken);
                if (accountId is null)
                    return Results.Unauthorized();
                var access = await services
                    .GetRequiredService<OrganizationAccessService>()
                    .ResolveAccessAsync(accountId.Value, cancellationToken);
                if (access is null)
                    return Results.StatusCode(StatusCodes.Status403Forbidden);

                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var exists = await db.Programs.AsNoTracking().AnyAsync(p =>
                    p.Id == id && p.OrganizationId == access.OrganizationId &&
                    p.RegistrationKey != null && p.RegisteredAtUtc != null,
                    cancellationToken);
                if (!exists)
                    return Results.NotFound();

                var alreadyRead = await db.NotificationReads.AsNoTracking()
                    .AnyAsync(r => r.OrganizationId == access.OrganizationId &&
                        r.ProgramId == id && r.AccountId == accountId.Value,
                        cancellationToken);
                if (alreadyRead)
                    return Results.NoContent();

                db.NotificationReads.Add(new OrganizationNotificationReadRecord
                {
                    OrganizationId = access.OrganizationId,
                    ProgramId = id,
                    AccountId = accountId.Value,
                    ReadAtUtc = DateTimeOffset.UtcNow
                });
                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested)
                {
                    // Concurrent identical requests may race on the composite
                    // primary key. Verify the exact member receipt before
                    // treating the retry as successful.
                    var settled = await db.NotificationReads.AsNoTracking()
                        .AnyAsync(r => r.OrganizationId == access.OrganizationId &&
                            r.ProgramId == id && r.AccountId == accountId.Value,
                            cancellationToken);
                    if (!settled) throw;
                }
                return Results.NoContent();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("MarkOrganizationNotificationRead")
        .WithTags("Organization")
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
