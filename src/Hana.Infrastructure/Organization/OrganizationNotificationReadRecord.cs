namespace Hana.Infrastructure.Organization;

/// <summary>Per-member read receipt for a registered Program notification.</summary>
public sealed class OrganizationNotificationReadRecord
{
    public Guid OrganizationId { get; set; }
    public Guid ProgramId { get; set; }
    public Guid AccountId { get; set; }
    public DateTimeOffset ReadAtUtc { get; set; }
}
