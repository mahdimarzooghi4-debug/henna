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
    public string Status { get; set; } = "DRAFT";
    public int Revision { get; set; } = 1;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
