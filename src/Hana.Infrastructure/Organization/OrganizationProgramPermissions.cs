namespace Hana.Infrastructure.Organization;

/// <summary>
/// Explicit portal role policy. Unknown/new roles fail closed for mutation.
/// Active organization members may use read endpoints; only PORTAL_ADMIN can
/// create/edit/register program drafts until a broader role matrix is approved.
/// </summary>
public static class OrganizationProgramPermissions
{
    public const string PortalAdmin = "PORTAL_ADMIN";

    public static bool CanManageDrafts(string? memberRole) =>
        IsPortalAdmin(memberRole);

    public static bool CanRegisterDrafts(string? memberRole) =>
        IsPortalAdmin(memberRole);

    private static bool IsPortalAdmin(string? memberRole) =>
        string.Equals(
            memberRole,
            PortalAdmin,
            StringComparison.Ordinal);
}
