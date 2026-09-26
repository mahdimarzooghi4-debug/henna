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
