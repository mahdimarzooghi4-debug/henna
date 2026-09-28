namespace Hana.Infrastructure.Buyer;

/// <summary>
/// An account-owned list of desired catalog goods. It is not a quote,
/// reservation, purchase order, or statement of current availability.
/// </summary>
public sealed class BuyerReferenceCartRecord
{
    public Guid AccountId { get; set; }
    public long Revision { get; set; }
    public string ItemsJson { get; set; } = "[]";
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
