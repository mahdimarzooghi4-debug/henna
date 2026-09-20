namespace Hana.Infrastructure.Catalog;

/// <summary>
/// Database receipt for an applied operator import, not an assertion that
/// a human reviewer was authenticated. The receipt and domain writes commit
/// in the same transaction; previews and rejected batches get no receipt.
/// </summary>
public sealed class CatalogImportReceipt
{
    public Guid Id { get; set; }
    public string ContentSha256 { get; set; } = null!;
    public DateTimeOffset AppliedAtUtc { get; set; }
    public int NewParents { get; set; }
    public int ChangedParents { get; set; }
    public int NewChildren { get; set; }
    public int ChangedChildren { get; set; }
}
