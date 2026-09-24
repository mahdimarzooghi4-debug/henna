using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;

namespace Hana.Api;

internal static class OrganizationAllocationReadinessEndpoints
{
    private sealed record Access(
        Guid OrganizationId,
        string MemberRole);

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
                : (new Access(
                    access.OrganizationId,
                    access.MemberRole), null);
        }
        catch (Exception) when (
            !cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    private static object ExecutionBoundary() => new
    {
        enabled = false,
        state = "NOT_CONFIGURED",
        monetaryMutationSupported = false
    };

    private static object HistoryBoundary() => new
    {
        available = false,
        items = Array.Empty<object>()
    };

    private static object ProgramDto(
        OrganizationAllocationProgramReadiness program) => new
    {
        program.Id,
        program.Name,
        program.Status,
        program.AllocationMethod,
        program.InputRecordCount,
        program.ReadyRecordCount,
        program.NeedsReviewRecordCount,
        sources = new
        {
            program.ManualRecordCount,
            program.ApiRecordCount
        }
    };

    internal static void MapOrganizationAllocationReadiness(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapGet(
            "/api/v1/organization/allocation/readiness",
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

                    return Results.Ok(new
                    {
                        readiness.OrganizationType,
                        allocationMethod =
                            readiness.DefaultAllocationMethod,
                        targetPeriod = (string?)null,
                        readiness.EligibleProgramCount,
                        readiness.InputRecordCount,
                        readiness.ReadyRecordCount,
                        readiness.NeedsReviewRecordCount,
                        sources = new
                        {
                            readiness.ManualRecordCount,
                            readiness.ApiRecordCount
                        },
                        programs = readiness.Programs
                            .Select(ProgramDto)
                            .ToArray(),
                        execution = ExecutionBoundary(),
                        processHistory = HistoryBoundary()
                    });
                }
                catch (Exception) when (
                    !cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            })
        .WithName("GetOrganizationAllocationReadiness")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        app.MapGet(
            "/api/v1/organization/allocation/readiness/{programId:guid}",
            async (
                Guid programId,
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
                if (programId == Guid.Empty)
                    return Results.NotFound();

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
                        .ResolveProgramAsync(
                            authorized.Access!.OrganizationId,
                            programId,
                            cancellationToken);
                    if (readiness is null)
                        return Results.NotFound();

                    return Results.Ok(new
                    {
                        program = ProgramDto(readiness),
                        targetPeriod = (string?)null,
                        execution = ExecutionBoundary(),
                        result = new
                        {
                            available = false,
                            allocatedRecordCount = (int?)null,
                            needsReviewRecordCount =
                                readiness.NeedsReviewRecordCount
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
        .WithName("GetOrganizationAllocationProgramReadiness")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
