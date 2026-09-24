using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationProgramEndpoints
{
    private sealed record RequestAccess(
        Guid OrganizationId,
        string MemberRole);

    private static async Task<(RequestAccess? Access, IResult? Error)> AuthorizeAsync(
        HttpContext context,
        IServiceProvider services,
        bool hasDatabase,
        bool isDevelopment,
        CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps && !isDevelopment)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith(
                "Bearer ", StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(authorization[7..], out _))
            return (null, Results.Unauthorized());

        if (!hasDatabase)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        try
        {
            var accountId = await services.GetRequiredService<AuthSessionService>()
                .ResolveAccountAsync(authorization[7..], cancellationToken);
            if (accountId is null)
                return (null, Results.Unauthorized());

            var access = await services
                .GetRequiredService<OrganizationAccessService>()
                .ResolveAccessAsync(accountId.Value, cancellationToken);
            return access is null
                ? (null, Results.StatusCode(StatusCodes.Status403Forbidden))
                : (new RequestAccess(
                    access.OrganizationId, access.MemberRole), null);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    internal static void MapOrganizationPrograms(
        this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/organization/programs")
            .WithTags("Organization");

        routes.MapGet("", async (
            HttpContext context,
            IServiceProvider services,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] string? status,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";

            var allowedQuery = new HashSet<string>(
                ["page", "pageSize", "status"],
                StringComparer.OrdinalIgnoreCase);
            if (context.Request.Query.Keys.Any(k => !allowedQuery.Contains(k)))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] = ["پارامتر ناشناخته در درخواست وجود دارد."]
                    });

            var number = page ?? 1;
            var size = pageSize ?? 20;
            var normalizedStatus = string.IsNullOrWhiteSpace(status)
                ? null : status.Trim().ToUpperInvariant();

            if (number is < 1 or > 10000 ||
                size is < 1 or > 50 ||
                (normalizedStatus is not null &&
                    !OrganizationProgramStates.IsKnown(normalizedStatus)))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] =
                            ["پارامترهای وضعیت یا صفحه‌بندی معتبر نیست."]
                    });

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var query = db.Programs.AsNoTracking()
                    .Where(p => p.OrganizationId == auth.Access!.OrganizationId);

                if (normalizedStatus is not null)
                    query = query.Where(p => p.Status == normalizedStatus);

                var total = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(p => p.CreatedAtUtc)
                    .ThenBy(p => p.Id)
                    .Skip((number - 1) * size)
                    .Take(size)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.Kind,
                        p.AllocationMethod,
                        p.BeneficiarySource,
                        p.Status,
                        p.CreatedAtUtc,
                        p.UpdatedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    items,
                    page = number,
                    pageSize = size,
                    total
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetOrganizationPrograms")
        .ProducesValidationProblem();

        routes.MapGet("/{id:guid}", async (
            Guid id,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (id == Guid.Empty) return Results.NotFound();

            if (context.Request.Query.Count != 0)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] = ["این مسیر پارامتر query نمی‌پذیرد."]
                    });

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var item = await db.Programs.AsNoTracking()
                    .Where(p => p.Id == id &&
                        p.OrganizationId == auth.Access!.OrganizationId)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.Kind,
                        p.AllocationMethod,
                        p.BeneficiarySource,
                        p.Description,
                        p.Status,
                        p.CreatedAtUtc,
                        p.UpdatedAtUtc
                    })
                    .SingleOrDefaultAsync(cancellationToken);

                // Cross-tenant IDs are intentionally indistinguishable from
                // nonexistent IDs to prevent organization enumeration.
                return item is null ? Results.NotFound() : Results.Ok(item);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetOrganizationProgram")
        .ProducesValidationProblem();
    }
}
