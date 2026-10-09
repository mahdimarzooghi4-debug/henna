namespace Hana.Infrastructure.Seller;

/// <summary>
/// Auditable operator suspension of an already activated seller. Historical
/// activation remains intact; an open suspension blocks seller access.
/// </summary>
public sealed class SellerSuspensionRecord
{
    public Guid Id { get; set; }
    public Guid ApplicationAccountId { get; set; }
    public Guid SuspendedByAccountId { get; set; }
    public Guid SuspensionKey { get; set; }
    public int ExpectedRevision { get; set; }
    public string Reason { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? RestoredAtUtc { get; set; }
    public Guid? RestoredByAccountId { get; set; }
    public Guid? RestoreKey { get; set; }
    public int? RestoreExpectedRevision { get; set; }
}
