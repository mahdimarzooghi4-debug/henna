namespace Hana.Infrastructure.Organization;

/// <summary>
/// Organization-owned program/credit definition used by the portal read model.
/// This is not an allocation, beneficiary entitlement, wallet balance or ledger.
/// </summary>
public sealed class OrganizationProgramRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public string Kind { get; set; } = null!;
    public string AllocationMethod { get; set; } = null!;
    public string BeneficiarySource { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = OrganizationProgramStates.Draft;
    public int Revision { get; set; } = 1;
    public Guid? CreationKey { get; set; }
    public string? CreationFingerprint { get; set; }
    public Guid? CreatedByAccountId { get; set; }
    public Guid? UpdatedByAccountId { get; set; }
    public Guid? RegistrationKey { get; set; }
    public int? RegistrationExpectedRevision { get; set; }
    public Guid? RegisteredByAccountId { get; set; }
    public DateTimeOffset? RegisteredAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
