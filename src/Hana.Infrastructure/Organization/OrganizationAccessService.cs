using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Organization;

public sealed record OrganizationPortalAccess(
    Guid OrganizationId,
    string MemberRole);

public sealed record OrganizationProfileAccess(
    Guid OrganizationId,
    string Name,
    string OrganizationType,
    string DefaultAllocationMethod,
    string? Phone,
    string? Email,
    string? Address,
    string? RepresentativeName,
    string? RepresentativePhone,
    DateTimeOffset? VerifiedAtUtc,
    string MemberRole);

/// <summary>
/// Resolves the organization available to a verified Identity account.
/// Missing/inactive memberships fail closed; there is no implicit org role.
/// </summary>
public sealed class OrganizationAccessService(HanaOrganizationDbContext db)
{
    public async Task<OrganizationPortalAccess?> ResolveAccessAsync(
        Guid accountId, CancellationToken cancellationToken = default)
    {
        return await (
            from membership in db.Memberships.AsNoTracking()
            join organization in db.Organizations.AsNoTracking()
                on membership.OrganizationId equals organization.Id
            where membership.AccountId == accountId
                && membership.IsActive
                && organization.IsActive
            select new OrganizationPortalAccess(
                organization.Id, membership.Role))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<OrganizationProfileAccess?> ResolveProfileAsync(
        Guid accountId, CancellationToken cancellationToken = default)
    {
        return await (
            from membership in db.Memberships.AsNoTracking()
            join organization in db.Organizations.AsNoTracking()
                on membership.OrganizationId equals organization.Id
            where membership.AccountId == accountId
                && membership.IsActive
                && organization.IsActive
            select new OrganizationProfileAccess(
                organization.Id,
                organization.Name,
                organization.OrganizationType,
                organization.DefaultAllocationMethod,
                organization.Phone,
                organization.Email,
                organization.Address,
                organization.RepresentativeName,
                organization.RepresentativePhone,
                organization.VerifiedAtUtc,
                membership.Role))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
