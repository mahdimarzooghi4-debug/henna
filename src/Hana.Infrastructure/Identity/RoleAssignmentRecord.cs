namespace Hana.Infrastructure.Identity;

/// <summary>
/// Explicit account role assignment. Having an account, a verified phone, or
/// a seller registration never implies an administrative role.
/// </summary>
public sealed class RoleAssignmentRecord
{
    public Guid AccountId { get; set; }
    public string Role { get; set; } = null!;
    public DateTimeOffset GrantedAtUtc { get; set; }
}

public static class HanaRoles
{
    public const string Admin = "ADMIN";
}
