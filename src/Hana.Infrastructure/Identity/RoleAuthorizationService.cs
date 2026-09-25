using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Server-side role authorization. Roles are read from Identity persistence on
/// every privileged request; client claims never grant administrative access.
/// </summary>
public sealed class RoleAuthorizationService(
    HanaIdentityDbContext db,
    AuthSessionService sessions)
{
    public async Task<Guid?> ResolveAccountInRoleAsync(
        string? bearerToken,
        string role,
        CancellationToken cancellationToken = default)
    {
        var accountId = await sessions.ResolveAccountAsync(
            bearerToken, cancellationToken);
        if (accountId is null) return null;

        return await db.RoleAssignments.AsNoTracking().AnyAsync(
            x => x.AccountId == accountId && x.Role == role,
            cancellationToken)
            ? accountId
            : null;
    }
}
