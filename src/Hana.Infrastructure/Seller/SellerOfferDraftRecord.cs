namespace Hana.Infrastructure.Seller;

/// <summary>
/// A seller-owned reference to a Catalog identity. It is a DRAFT container,
/// not a price, inventory claim or purchasable listing.
/// </summary>
public sealed class SellerOfferDraftRecord
{
    public Guid Id { get; set; }
    public Guid SellerAccountId { get; set; }
    public Guid CatalogProductId { get; set; }
    public string Status { get; set; } = SellerOfferDraftStates.Draft;
    public int Revision { get; set; } = 1;
    public Guid IdempotencyKey { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public static class SellerOfferDraftStates
{
    public const string Draft = "DRAFT";
}
