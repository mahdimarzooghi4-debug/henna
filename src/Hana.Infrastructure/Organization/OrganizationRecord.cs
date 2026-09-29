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
    public string? HousingTenure { get; set; }
    public string? HealthBurdenLevel { get; set; }
    public string? EconomicHardshipLevel { get; set; }
    public string? CareSupportLevel { get; set; }
    public string? EducationAttainment { get; set; }
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
    public bool? NeedsPracticalSupport { get; set; }
}

/// <summary>
/// Immutable calculation-only batch. A preview is not an award, reservation,
/// wallet credit, or ledger posting.
/// </summary>
public sealed class OrganizationAllocationPreviewRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid ProgramId { get; set; }
    public int ProgramRevision { get; set; }
    public Guid FundingInstructionId { get; set; }
    public string AllocationMode { get; set; } = null!;
    public string FundingSource { get; set; } = null!;
    public string FundingSourceReference { get; set; } = null!;
    public string InstructionReference { get; set; } = null!;
    public string FundingInstructionState { get; set; } = null!;
    public string State { get; set; } = "PREVIEW_ONLY";
    public string PayloadSha256 { get; set; } = null!;
    public string SnapshotJson { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid CreatedByAccountId { get; set; }
    public Guid CreationKey { get; set; }
}

public static class OrganizationSettlementTypes
{
    public const string Urban = "URBAN";
    public const string Rural = "RURAL";
}

public static class OrganizationHousingTenureTypes
{
    public const string Owner = "OWNER";
    public const string Tenant = "TENANT";
}

public static class OrganizationAllocationAssessmentTypes
{
    public const string HealthNone = "NO_ONGOING_TREATMENT";
    public const string HealthOneManageable = "ONE_MANAGEABLE_ONGOING_CASE";
    public const string HealthHighBurden = "HIGH_COST_OR_LIMITING_OR_MULTIPLE_MANAGEABLE_CASES";
    public const string HealthSevere = "SEVERE_ONGOING_CARE_OR_MULTIPLE_HIGH_BURDEN_CASES";

    public const string HardshipNeedsMet = "ESSENTIAL_NEEDS_GENERALLY_MET";
    public const string HardshipOccasionalShortfall = "OCCASIONAL_SHORTFALL_IN_ONE_ESSENTIAL_NEED";
    public const string HardshipRecurrentShortfall = "RECURRENT_SHORTFALL_OR_ESSENTIAL_DEBT";
    public const string HardshipMultipleUnmet = "MULTIPLE_ESSENTIAL_NEEDS_UNMET_OR_SEVERE_INSTABILITY";

    public const string CareSupportAvailable = "EFFECTIVE_ADULT_OR_PRACTICAL_SUPPORT_AVAILABLE";
    public const string OneAdultNoDependents = "ONE_RESPONSIBLE_ADULT_WITHOUT_DEPENDENTS";
    public const string LoneCaregiverOneDependent = "LONE_CAREGIVER_WITH_ONE_DEPENDENT_OR_LIMITED_SUPPORT";
    public const string NoPracticalSupport = "NO_PRACTICAL_SUPPORT_WITH_MULTIPLE_DEPENDENTS_OR_HIGH_CARE_BURDEN";

    public const string EducationBachelorOrHigher = "BACHELOR_OR_HIGHER";
    public const string EducationDiplomaOrAssociate = "DIPLOMA_OR_ASSOCIATE";
    public const string EducationBelowDiploma = "BELOW_DIPLOMA_WITH_FORMAL_EDUCATION";
    public const string EducationNoFormalOrLiteracy = "NO_LITERACY_OR_FORMAL_EDUCATION";
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
