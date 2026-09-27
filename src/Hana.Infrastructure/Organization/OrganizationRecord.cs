namespace Hana.Infrastructure.Organization;

public sealed class OrganizationRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid CreatedByAccountId { get; set; }
    public Guid CreationKey { get; set; }
}

public static class OrganizationRoles
{
    public const string Lead = "ORG_LEAD";
    public const string Representative = "ORG_REPRESENTATIVE";
    public const string TechnicalOperator = "ORG_TECHNICAL_OPERATOR";
}

public sealed class OrganizationMembershipRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid AccountId { get; set; }
    public string Role { get; set; } = null!;
    public Guid GrantedByAccountId { get; set; }
    public DateTimeOffset GrantedAtUtc { get; set; }
    public Guid? RevokedByAccountId { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public Guid GrantKey { get; set; }
    public Guid? RevokeKey { get; set; }
}

/// <summary>
/// A program proposal owned by one organization. Its allocation mode is intent only:
/// creating this record never creates a funding instruction or wallet credit.
/// </summary>
public sealed class OrganizationProgramRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public string AllocationMode { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string State { get; set; } = "DRAFT";
    public int Revision { get; set; } = 1;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid CreatedByAccountId { get; set; }
    public Guid CreationKey { get; set; }
}

public static class OrganizationAllocationModes
{
    public const string HennaNeedsBased = "HENNA_NEEDS_BASED";
    public const string OrganizationDefined = "ORGANIZATION_DEFINED";
}
