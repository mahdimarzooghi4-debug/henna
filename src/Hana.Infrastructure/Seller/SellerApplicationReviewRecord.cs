namespace Hana.Infrastructure.Seller;

public sealed class SellerApplicationReviewRecord
{
    public Guid Id { get; set; }
    public Guid ApplicationAccountId { get; set; }
    public Guid ReviewerAccountId { get; set; }
    public Guid DecisionKey { get; set; }
    public int ExpectedRevision { get; set; }
    public string Decision { get; set; } = null!;
    public string? Reason { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
