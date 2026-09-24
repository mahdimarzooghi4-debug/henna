namespace Hana.Infrastructure.Organization;

/// <summary>
/// Recipient mutation permissions. Unknown roles fail closed.
/// Read access remains governed by active organization membership.
/// </summary>
public static class OrganizationRecipientPermissions
{
    public static bool CanCreateManual(string? memberRole) =>
        string.Equals(
            memberRole,
            OrganizationProgramPermissions.PortalAdmin,
            StringComparison.Ordinal);
}
