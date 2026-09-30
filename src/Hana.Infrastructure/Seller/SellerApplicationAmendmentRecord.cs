namespace Hana.Infrastructure.Seller;

public sealed class SellerApplicationAmendmentRecord
{
    public Guid Id { get; set; }
    public Guid ApplicationAccountId { get; set; }
    public int BaseRevision { get; set; }
    public string Status { get; set; } = "OPEN";
    public string ReviewerReason { get; set; } = null!;
    public string ResponseText { get; set; } = null!;
    public string? ReferenceUrl { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ResubmittedAtUtc { get; set; }
}
