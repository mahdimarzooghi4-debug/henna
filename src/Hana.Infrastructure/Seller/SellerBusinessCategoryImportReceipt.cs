namespace Hana.Infrastructure.Seller;

/// <summary>
/// Audit receipt for an applied reviewed business-category import.
/// A receipt proves the exact reviewed bytes were applied, not who reviewed them.
/// </summary>
public sealed class SellerBusinessCategoryImportReceipt
{
    public Guid Id { get; set; }
    public string ContentSha256 { get; set; } = null!;
    public DateTimeOffset AppliedAtUtc { get; set; }
    public int NewCategories { get; set; }
    public int ChangedCategories { get; set; }
}
