namespace Hana.Infrastructure.Seller;

/// <summary>
/// A seller-owned goods offer. Catalog continues to own product identity and
/// canonical unit; this row owns price, quantity and publication state.
/// </summary>
public sealed class SellerOfferDraftRecord
{
    public Guid Id { get; set; }
    public Guid SellerAccountId { get; set; }
    public Guid CatalogProductId { get; set; }
    public string Status { get; set; } = SellerOfferDraftStates.Draft;
    public int Revision { get; set; } = 1;
    public Guid IdempotencyKey { get; set; }
    public long? PriceRials { get; set; }
    public decimal? SellableQuantity { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public static class SellerOfferDraftStates
{
    public const string Draft = "DRAFT";
    public const string Published = "PUBLISHED";
    public const string Paused = "PAUSED";
}
