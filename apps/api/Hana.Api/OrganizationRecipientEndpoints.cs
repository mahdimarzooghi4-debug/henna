using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationRecipientEndpoints
{
    private sealed record RecipientAccess(Guid OrganizationId);

    private static async Task<(RecipientAccess? Access, IResult? Error)>
        AuthorizeAsync(
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
                : (new RecipientAccess(access.OrganizationId), null);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    private static IResult InvalidQuery(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["query"] = [message]
        });

    private static bool HasControlCharacters(string value) =>
        value.Any(char.IsControl);

    private static string EscapeLike(string value) =>
        value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    internal static void MapOrganizationRecipients(
        this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/organization/recipients", async (
            HttpContext context,
            IServiceProvider services,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] string? programId,
            [FromQuery] string? source,
            [FromQuery] string? matchStatus,
            [FromQuery] string? search,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";

            var allowedQuery = new HashSet<string>(
                ["page", "pageSize", "programId", "source", "matchStatus", "search"],
                StringComparer.OrdinalIgnoreCase);
            if (context.Request.Query.Keys.Any(k => !allowedQuery.Contains(k)))
                return InvalidQuery(
                    "پارامتر ناشناخته در درخواست وجود دارد.");
            if (context.Request.Query.Any(pair => pair.Value.Count != 1))
                return InvalidQuery(
                    "هر پارامتر query فقط یک مقدار می‌پذیرد.");

            var number = page ?? 1;
            var size = pageSize ?? 20;
            if (number is < 1 or > 10000 || size is < 1 or > 50)
                return InvalidQuery("صفحه‌بندی معتبر نیست.");

            Guid? normalizedProgramId = null;
            if (!string.IsNullOrWhiteSpace(programId))
            {
                if (!Guid.TryParse(programId.Trim(), out var parsedProgramId) ||
                    parsedProgramId == Guid.Empty)
                    return InvalidQuery("شناسه طرح معتبر نیست.");
                normalizedProgramId = parsedProgramId;
            }

            var normalizedSource = string.IsNullOrWhiteSpace(source)
                ? null : source.Trim().ToUpperInvariant();
            if (normalizedSource is not null &&
                !OrganizationRecipientSources.IsKnown(normalizedSource))
                return InvalidQuery("منبع ثبت معتبر نیست.");

            var normalizedMatchStatus = string.IsNullOrWhiteSpace(matchStatus)
                ? null : matchStatus.Trim().ToUpperInvariant();
            if (normalizedMatchStatus is not null &&
                !OrganizationRecipientMatchStates.IsKnown(
                    normalizedMatchStatus))
                return InvalidQuery("وضعیت تطبیق معتبر نیست.");

            var normalizedSearch = string.IsNullOrWhiteSpace(search)
                ? null : search.Trim();
            if (normalizedSearch is not null &&
                (normalizedSearch.Length > 120 ||
                    HasControlCharacters(normalizedSearch)))
                return InvalidQuery("عبارت جستجو معتبر نیست.");

            var auth = await AuthorizeAsync(
                context,
                services,
                hasDatabase,
                app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var recipients = db.Recipients.AsNoTracking()
                    .Where(r =>
                        r.OrganizationId == auth.Access!.OrganizationId);

                if (normalizedProgramId is { } targetProgramId)
                    recipients = recipients.Where(
                        r => r.ProgramId == targetProgramId);
                if (normalizedSource is not null)
                    recipients = recipients.Where(
                        r => r.Source == normalizedSource);
                if (normalizedMatchStatus is not null)
                    recipients = recipients.Where(
                        r => r.MatchStatus == normalizedMatchStatus);
                if (normalizedSearch is not null)
                {
                    var pattern =
                        $"%{EscapeLike(normalizedSearch)}%";
                    recipients = recipients.Where(r =>
                        EF.Functions.ILike(
                            r.DisplayName, pattern, "\\") ||
                        EF.Functions.ILike(
                            r.ReferenceMasked, pattern, "\\"));
                }

                var total = await recipients.CountAsync(cancellationToken);
                var pageRows = recipients
                    .OrderByDescending(r => r.CreatedAtUtc)
                    .ThenBy(r => r.Id)
                    .Skip((number - 1) * size)
                    .Take(size);

                var items = await (
                    from recipient in pageRows
                    join program in db.Programs.AsNoTracking()
                        on new
                        {
                            Id = recipient.ProgramId,
                            recipient.OrganizationId
                        }
                        equals new
                        {
                            program.Id,
                            program.OrganizationId
                        }
                    select new
                    {
                        recipient.Id,
                        recipient.DisplayName,
                        recipient.ReferenceMasked,
                        recipient.Source,
                        recipient.MatchStatus,
                        hanaAccountMatched =
                            recipient.MatchedAccountId != null,
                        program = new
                        {
                            program.Id,
                            program.Name,
                            program.Status
                        },
                        recipient.CreatedAtUtc,
                        recipient.UpdatedAtUtc
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
        .WithName("GetOrganizationRecipients")
        .WithTags("Organization")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
