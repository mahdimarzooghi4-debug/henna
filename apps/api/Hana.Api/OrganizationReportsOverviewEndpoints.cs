using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;

namespace Hana.Api;

internal static class OrganizationReportsOverviewEndpoints
{
    private sealed record Access(Guid OrganizationId);

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

            var access = await services
                .GetRequiredService<OrganizationAccessService>()
                .ResolveAccessAsync(
                    accountId.Value,
                    cancellationToken);
            return access is null
                ? (null, Results.StatusCode(
                    StatusCodes.Status403Forbidden))
                : (new Access(access.OrganizationId), null);
        }
        catch (Exception) when (
            !cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    internal static void MapOrganizationReportsOverview(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapGet(
            "/api/v1/organization/reports/overview",
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

                try
                {
                    var readiness = await services
                        .GetRequiredService<
                            OrganizationAllocationReadinessService>()
                        .ResolveAsync(
                            authorized.Access!.OrganizationId,
                            cancellationToken);
                    if (readiness is null)
                        return Results.StatusCode(
                            StatusCodes.Status403Forbidden);

                    decimal? matchRatePercent = null;
                    if (readiness.InputRecordCount > 0)
                    {
                        matchRatePercent = decimal.Round(
                            readiness.ReadyRecordCount * 100m /
                                readiness.InputRecordCount,
                            2,
                            MidpointRounding.AwayFromZero);
                    }

                    return Results.Ok(new
                    {
                        readiness.OrganizationType,
                        lastRecordedSyncAtUtc =
                            (DateTimeOffset?)null,
                        matching = new
                        {
                            available = true,
                            scope =
                                "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS",
                            readiness.EligibleProgramCount,
                            totalEnrollmentRecordCount =
                                readiness.InputRecordCount,
                            matchedRecordCount =
                                readiness.ReadyRecordCount,
                            needsReviewRecordCount =
                                readiness.NeedsReviewRecordCount,
                            matchRatePercent
                        },
                        usage = new
                        {
                            available = false,
                            usedBudget = (object?)null,
                            utilizationPercent = (decimal?)null
                        },
                        allocationDistributionTrend = new
                        {
                            available = false,
                            points = Array.Empty<object>()
                        },
                        capability = new
                        {
                            financialReportingAvailable = false,
                            allocationDistributionTrendAvailable = false
                        }
                    });
                }
                catch (Exception) when (
                    !cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            })
        .WithName("GetOrganizationReportsOverview")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
