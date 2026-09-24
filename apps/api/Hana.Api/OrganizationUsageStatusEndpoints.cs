using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;

namespace Hana.Api;

internal static class OrganizationUsageStatusEndpoints
{
    private sealed record Access(string OrganizationType);

    private static async Task<(Access? Access, IResult? Error)> AuthorizeAsync(
        HttpContext context,
        IServiceProvider services,
        bool hasDatabase,
        bool isDevelopment,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";

        if (!context.Request.IsHttps && !isDevelopment)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        var authorization =
            context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith(
                "Bearer ",
                StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(
                authorization[7..],
                out _))
            return (null, Results.Unauthorized());

        if (!hasDatabase)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        try
        {
            var accountId = await services
                .GetRequiredService<AuthSessionService>()
                .ResolveAccountAsync(
                    authorization[7..],
                    cancellationToken);
            if (accountId is null)
                return (null, Results.Unauthorized());

            var profile = await services
                .GetRequiredService<OrganizationAccessService>()
                .ResolveProfileAsync(
                    accountId.Value,
                    cancellationToken);
            return profile is null
                ? (null, Results.StatusCode(
                    StatusCodes.Status403Forbidden))
                : (new Access(profile.OrganizationType), null);
        }
        catch (Exception) when (
            !cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    internal static void MapOrganizationUsageStatus(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapGet(
            "/api/v1/organization/usage/status",
            async (
                HttpContext context,
                IServiceProvider services,
                CancellationToken cancellationToken) =>
            {
                if (context.Request.Query.Count != 0)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["query"] =
                            [
                                "این مسیر پارامتر query نمی‌پذیرد."
                            ]
                        });

                var authorized = await AuthorizeAsync(
                    context,
                    services,
                    hasDatabase,
                    app.Environment.IsDevelopment(),
                    cancellationToken);
                if (authorized.Error is not null)
                    return authorized.Error;

                return Results.Ok(new
                {
                    organizationType =
                        authorized.Access!.OrganizationType,
                    lastRecordedSyncAtUtc =
                        (DateTimeOffset?)null,
                    summary = new
                    {
                        available = false,
                        totalAllocated = (object?)null,
                        activeInUse = (object?)null,
                        consumed = (object?)null,
                        idleOrUnused = (object?)null
                    },
                    beneficiaryUsage = new
                    {
                        available = false,
                        items = Array.Empty<object>()
                    },
                    capability = new
                    {
                        state = "NOT_CONFIGURED",
                        monetaryUsageReadModelAvailable = false,
                        ledgerAvailable = false
                    }
                });
            })
        .WithName("GetOrganizationUsageStatus")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
