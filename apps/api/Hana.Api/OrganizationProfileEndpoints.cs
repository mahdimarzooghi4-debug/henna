using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;

namespace Hana.Api;

public static class OrganizationProfileEndpoints
{
    public static void MapOrganizationProfile(
        this WebApplication app, bool hasOrganizationDb)
    {
        app.MapGet("/api/v1/organization/me", async (
                HttpContext context,
                AuthSessionService sessions,
                OrganizationAccessService access,
                CancellationToken cancellationToken) =>
            {
                context.Response.Headers.CacheControl = "no-store";

                if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                    return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

                var authorization = context.Request.Headers.Authorization.ToString();
                if (!authorization.StartsWith(
                        "Bearer ", StringComparison.OrdinalIgnoreCase) ||
                    !SessionTokenCodec.TryComputeDigest(authorization[7..], out _))
                    return Results.Unauthorized();

                if (!hasOrganizationDb)
                    return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

                try
                {
                    var accountId = await sessions.ResolveAccountAsync(
                        authorization[7..], cancellationToken);
                    if (accountId is null)
                        return Results.Unauthorized();

                    var profile = await access.ResolveProfileAsync(
                        accountId.Value, cancellationToken);
                    if (profile is null)
                        return Results.StatusCode(StatusCodes.Status403Forbidden);

                    return Results.Ok(new
                    {
                        organizationId = profile.OrganizationId,
                        name = profile.Name,
                        organizationType = profile.OrganizationType,
                        defaultAllocationMethod = profile.DefaultAllocationMethod,
                        phone = profile.Phone,
                        email = profile.Email,
                        address = profile.Address,
                        representativeName = profile.RepresentativeName,
                        representativePhone = profile.RepresentativePhone,
                        verified = profile.VerifiedAtUtc is not null,
                        active = true,
                        memberRole = profile.MemberRole
                    });
                }
                catch (Exception) when (!cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            })
            .WithName("GetCurrentOrganizationProfile")
            .WithTags("Organization")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
