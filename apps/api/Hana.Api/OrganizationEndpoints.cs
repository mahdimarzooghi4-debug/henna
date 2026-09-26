using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationEndpoints
{
    private static readonly string[] Roles =
    [OrganizationRoles.Lead, OrganizationRoles.Representative, OrganizationRoles.TechnicalOperator];

    internal static void MapOrganization(this WebApplication app, bool hasDatabase)
    {
        app.MapPost("/api/v1/admin/organizations", async (
            ProvisionOrganizationInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            var name = input.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name) || name.Length > 160 || input.InitialAccountId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["organization"] = ["اطلاعات سازمان معتبر نیست."] });
            if (!Roles.Contains(input.Role, StringComparer.Ordinal) || !Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["نقش یا کلید درخواست معتبر نیست."] });

            try
            {
                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                if (!await identity.Accounts.AnyAsync(x => x.Id == input.InitialAccountId, cancellationToken))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["accountId"] = ["حساب کاربری پیدا نشد."] });
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var prior = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                {
                    var priorMembership = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.GrantKey == key, cancellationToken);
                    if (prior.CreatedByAccountId != auth.AccountId || prior.Name != name || priorMembership is null || priorMembership.OrganizationId != prior.Id || priorMembership.AccountId != input.InitialAccountId || priorMembership.Role != input.Role) return Results.Conflict();
                    return Results.Ok(new { organizationId = prior.Id, name = prior.Name, createdAtUtc = prior.CreatedAtUtc });
                }

                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                var organization = new OrganizationRecord { Id = Guid.NewGuid(), Name = name, CreatedAtUtc = now, CreatedByAccountId = auth.AccountId!.Value, CreationKey = key };
                db.Organizations.Add(organization);
                db.Memberships.Add(new OrganizationMembershipRecord
                {
                    Id = Guid.NewGuid(), OrganizationId = organization.Id, AccountId = input.InitialAccountId,
                    Role = input.Role, GrantedByAccountId = auth.AccountId.Value, GrantedAtUtc = now, GrantKey = key
                });
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/admin/organizations/{organization.Id}", new { organizationId = organization.Id, name, createdAtUtc = now });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("ProvisionOrganization");

        app.MapPost("/api/v1/admin/organizations/{organizationId:guid}/memberships", async (
            Guid organizationId, GrantOrganizationMembershipInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (input.AccountId == Guid.Empty || !Roles.Contains(input.Role, StringComparer.Ordinal)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["membership"] = ["حساب یا نقش معتبر نیست."] });
            try
            {
                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                if (!await identity.Accounts.AnyAsync(x => x.Id == input.AccountId, cancellationToken)) return Results.NotFound();
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                if (!await db.Organizations.AnyAsync(x => x.Id == organizationId, cancellationToken)) return Results.NotFound();
                if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var grantKey) || grantKey == Guid.Empty) return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید درخواست معتبر نیست."] });
                var priorGrant = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.GrantKey == grantKey, cancellationToken);
                if (priorGrant is not null)
                {
                    if (priorGrant.OrganizationId != organizationId || priorGrant.AccountId != input.AccountId || priorGrant.Role != input.Role || priorGrant.GrantedByAccountId != auth.AccountId) return Results.Conflict();
                    return Results.Ok(new { membershipId = priorGrant.Id, priorGrant.OrganizationId, priorGrant.AccountId, priorGrant.Role, priorGrant.GrantedAtUtc });
                }
                if (await db.Memberships.AnyAsync(x => x.OrganizationId == organizationId && x.AccountId == input.AccountId && x.RevokedAtUtc == null, cancellationToken)) return Results.Conflict();
                var record = new OrganizationMembershipRecord { Id = Guid.NewGuid(), OrganizationId = organizationId, AccountId = input.AccountId, Role = input.Role, GrantedByAccountId = auth.AccountId!.Value, GrantedAtUtc = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime(), GrantKey = grantKey };
                db.Memberships.Add(record);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/admin/organizations/{organizationId}/memberships/{record.Id}", new { membershipId = record.Id, record.OrganizationId, record.AccountId, record.Role, record.GrantedAtUtc });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("GrantOrganizationMembership");

        app.MapDelete("/api/v1/admin/organizations/{organizationId:guid}/memberships/{membershipId:guid}", async (
            Guid organizationId, Guid membershipId, int revision, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (revision != 1) return Results.ValidationProblem(new Dictionary<string, string[]> { ["revision"] = ["نسخه عضویت معتبر نیست."] });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var revokeKey) || revokeKey == Guid.Empty) return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید درخواست معتبر نیست."] });
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var changed = await db.Memberships.Where(x => x.Id == membershipId && x.OrganizationId == organizationId && x.RevokedAtUtc == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAtUtc, services.GetRequiredService<IClock>().UtcNow.ToUniversalTime()).SetProperty(x => x.RevokedByAccountId, auth.AccountId).SetProperty(x => x.RevokeKey, revokeKey), cancellationToken);
                if (changed == 1) return Results.NoContent();
                var current = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.Id == membershipId && x.OrganizationId == organizationId, cancellationToken);
                if (current is null) return Results.NotFound();
                return current.RevokeKey == revokeKey && current.RevokedByAccountId == auth.AccountId ? Results.NoContent() : Results.Conflict(new { current.RevokedAtUtc });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("RevokeOrganizationMembership");

        app.MapGet("/api/v1/organization/profiles", async (HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (!hasDatabase) return Results.StatusCode(503);
            try
            {
                var sessions = services.GetRequiredService<AuthSessionService>();
                var accountId = await sessions.ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var profiles = await (from membership in db.Memberships.AsNoTracking()
                    join organization in db.Organizations.AsNoTracking() on membership.OrganizationId equals organization.Id
                    where membership.AccountId == accountId.Value && membership.RevokedAtUtc == null
                    orderby organization.Name
                    select new { organizationId = organization.Id, organizationName = organization.Name, memberRole = membership.Role, membershipId = membership.Id }).ToListAsync(cancellationToken);
                return profiles.Count == 0 ? Results.StatusCode(403) : Results.Ok(new { profiles });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("GetOrganizationProfiles");
    }

    private static async Task<(Guid? AccountId, IResult? Error)> Admin(HttpContext context, IServiceProvider services, bool hasDatabase, CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase) return (null, Results.StatusCode(503));
        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        var roles = services.GetRequiredService<RoleAuthorizationService>();
        return await roles.HasRoleAsync(accountId.Value, HanaRoles.Admin, cancellationToken)
            ? (accountId, null) : (null, Results.StatusCode(403));
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _) ? token : null;
    }
}

internal sealed record ProvisionOrganizationInput(string? Name, Guid InitialAccountId, string Role);
internal sealed record GrantOrganizationMembershipInput(Guid AccountId, string Role);
