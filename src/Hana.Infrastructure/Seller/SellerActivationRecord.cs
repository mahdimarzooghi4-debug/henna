namespace Hana.Infrastructure.Seller;

public sealed class SellerActivationRecord
{
    public Guid Id { get; set; }
    public Guid ApplicationAccountId { get; set; }
    public Guid ActivatedByAccountId { get; set; }
    public Guid ActivationKey { get; set; }
    public int ExpectedRevision { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
