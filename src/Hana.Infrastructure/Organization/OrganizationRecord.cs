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

/// <summary>
/// An organization-submitted reference to a funding instruction. PENDING_VERIFICATION
/// means the organization supplied a reference; it does not assert that the source
/// or authority has been verified and it never creates a credit allocation.
/// </summary>
public sealed class OrganizationFundingInstructionRecord
{
    public Guid Id { get; set; }
    public Guid ProgramId { get; set; }
    public int ProgramRevision { get; set; }
    public string AllocationMode { get; set; } = null!;
    public string SourceInstructionReference { get; set; } = null!;
    public string State { get; set; } = "PENDING_VERIFICATION";
    public int Revision { get; set; } = 1;
    public DateTimeOffset SubmittedAtUtc { get; set; }
    public Guid SubmittedByAccountId { get; set; }
    public Guid CreationKey { get; set; }
    public Guid? ReviewedByAccountId { get; set; }
    public DateTimeOffset? ReviewedAtUtc { get; set; }
    public string? ReviewReason { get; set; }
}

public sealed class OrganizationFundingInstructionEventRecord
{
    public Guid Id { get; set; }
    public Guid FundingInstructionId { get; set; }
    public int Revision { get; set; }
    public string EventType { get; set; } = null!;
    public string SourceInstructionReference { get; set; } = null!;
    public string? Reason { get; set; }
    public Guid ActorAccountId { get; set; }
    public DateTimeOffset OccurredAtUtc { get; set; }
    public Guid IdempotencyKey { get; set; }
}

public static class OrganizationFundingInstructionEvents
{
    public const string Verified = "VERIFIED";
    public const string Rejected = "REJECTED";
    public const string Resubmitted = "RESUBMITTED";
}

/// <summary>
/// An organization-referred household for a program. This record is intake only:
/// it does not assert eligibility, award support, or trigger an allocation.
/// </summary>
public sealed class OrganizationHouseholdReferralRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid ProgramId { get; set; }
    public string ExternalReference { get; set; } = null!;
    public Guid ProvinceId { get; set; }
    public Guid? CityId { get; set; }
    public string SettlementType { get; set; } = null!;
    public int Revision { get; set; } = 1;
    public DateTimeOffset SubmittedAtUtc { get; set; }
    public Guid SubmittedByAccountId { get; set; }
    public Guid CreationKey { get; set; }
}

/// <summary>Only non-identifying qualitative categories required for later review.</summary>
public sealed class OrganizationHouseholdMemberRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdReferralId { get; set; }
    public int MemberNumber { get; set; }
    public string GenderCategory { get; set; } = null!;
    public string LifeStage { get; set; } = null!;
    public string EducationLevel { get; set; } = null!;
    public string HealthNeed { get; set; } = null!;
}

public static class OrganizationSettlementTypes
{
    public const string Urban = "URBAN";
    public const string Rural = "RURAL";
}

public static class OrganizationHouseholdCategories
{
    public const string Female = "FEMALE";
    public const string Male = "MALE";
    public const string NotReported = "NOT_REPORTED";

    public const string Infant = "INFANT";
    public const string Preschool = "PRESCHOOL";
    public const string SchoolAge = "SCHOOL_AGE";
    public const string Adult = "ADULT";
    public const string OlderAdult = "OLDER_ADULT";

    public const string NoFormalEducation = "NO_FORMAL_EDUCATION";
    public const string Primary = "PRIMARY";
    public const string Secondary = "SECONDARY";
    public const string Diploma = "DIPLOMA";
    public const string HigherEducation = "HIGHER_EDUCATION";
    public const string EducationNotReported = "NOT_REPORTED";

    public const string NoKnownChronicNeed = "NO_KNOWN_CHRONIC_NEED";
    public const string ChronicNeed = "CHRONIC_NEED";
    public const string HealthNotReported = "NOT_REPORTED";
}

public static class OrganizationAllocationModes
{
    public const string HennaNeedsBased = "HENNA_NEEDS_BASED";
    public const string OrganizationDefined = "ORGANIZATION_DEFINED";
}
