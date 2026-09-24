namespace Hana.Infrastructure.Organization;

/// <summary>
/// Explicit portal access grant. An Identity account never becomes an
/// organization user merely by authenticating.
/// </summary>
public sealed class OrganizationMembershipRecord
{
    public Guid OrganizationId { get; set; }
    public Guid AccountId { get; set; }
    public string Role { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
