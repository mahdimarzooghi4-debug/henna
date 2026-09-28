namespace Hana.Infrastructure.Seller;

/// <summary>Append-only record of a seller offer revision or publication action.</summary>
public sealed class SellerOfferMutationRecord
{
    public Guid Id { get; set; }
    public Guid OfferId { get; set; }
    public Guid SellerAccountId { get; set; }
    public int ExpectedRevision { get; set; }
    public int ResultingRevision { get; set; }
    public string Action { get; set; } = null!;
    public string ResultingStatus { get; set; } = null!;
    public Guid IdempotencyKey { get; set; }
    public string RequestSha256 { get; set; } = null!;
    public long? PriceRials { get; set; }
    public decimal? SellableQuantity { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public static class SellerOfferMutationActions
{
    public const string Updated = "UPDATED";
    public const string Published = "PUBLISHED";
}
