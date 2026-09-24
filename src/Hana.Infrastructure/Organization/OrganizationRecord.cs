namespace Hana.Infrastructure.Organization;

/// <summary>
/// Organization identity/profile used by the organization portal. It contains
/// organization contact data only; it is not a ledger, allocation result, or
/// beneficiary record.
/// </summary>
public sealed class OrganizationRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string OrganizationType { get; set; } = null!;
    public string DefaultAllocationMethod { get; set; } = null!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? RepresentativeName { get; set; }
    public string? RepresentativePhone { get; set; }
    public DateTimeOffset? VerifiedAtUtc { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
