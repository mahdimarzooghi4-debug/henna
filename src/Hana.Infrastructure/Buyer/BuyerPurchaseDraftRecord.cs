namespace Hana.Infrastructure.Buyer;

/// <summary>
/// A buyer's editable, non-binding selection of published seller offers.
/// It is not sent to a seller and is not an order, quote or reservation.
/// </summary>
public sealed class BuyerPurchaseDraftRecord
{
    public Guid AccountId { get; set; }
    public long Revision { get; set; }
    public Guid SellerPublicId { get; set; }
    public string LinesJson { get; set; } = "[]";
    public bool IsDeleted { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

/// <summary>
/// Immutable idempotency receipt for a buyer purchase-draft mutation.
/// </summary>
public sealed class BuyerPurchaseDraftIdempotencyRecord
{
    public Guid AccountId { get; set; }
    public Guid Key { get; set; }
    public string RequestSha256 { get; set; } = "";
    public string ResponseJson { get; set; } = "{}";
    public int ResponseStatusCode { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
