namespace Hana.Infrastructure.Seller;

/// <summary>
/// Only initial seller onboarding details. A draft is NOT a verified or
/// activated store and grants no seller permissions.
/// </summary>
public sealed class SellerRegistrationDraft
{
    public Guid AccountId { get; set; }
    public string StoreName { get; set; } = null!;
    public string OwnerName { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string City { get; set; } = null!;
    public string Address { get; set; } = null!;
    public string PostalCode { get; set; } = null!;
    public string? ApplicantType { get; set; }
    public string? NaturalNationalCode { get; set; }
    public string? LegalNationalId { get; set; }
    public string? LegalName { get; set; }
    public string? LegalRepresentativeName { get; set; }
    public string? LegalRepresentativePhone { get; set; }
    public string? IdentityStatus { get; set; }
    public Guid? BusinessCategoryId { get; set; }
    public string? BusinessName { get; set; }
    public string? BusinessDescription { get; set; }
    public string? BusinessPhone { get; set; }
    public string? OfferingType { get; set; }
    public Guid? ActivityProvinceId { get; set; }
    public Guid? ActivityCityId { get; set; }
    public string? ActivityAddress { get; set; }
    public string? ActivityHours { get; set; }
    public bool? SellerDelivery { get; set; }
    public bool? Pickup { get; set; }
    public string? ServiceArea { get; set; }
    public string? RegistrationContactName { get; set; }
    public string? RegistrationContactRole { get; set; }
    public string? BackupPhone { get; set; }
    public string? WebsiteOrSocial { get; set; }
    public string? BusinessEmail { get; set; }
    public string? ResponseHours { get; set; }
    public int CompletedStep { get; set; } = 1;
    public string Status { get; set; } = "DRAFT";
    public int Revision { get; set; } = 1;
    public Guid? SubmissionKey { get; set; }
    public int? SubmissionExpectedRevision { get; set; }
    public DateTimeOffset? SubmittedAtUtc { get; set; }
    public DateTimeOffset? AccuracyConfirmedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
