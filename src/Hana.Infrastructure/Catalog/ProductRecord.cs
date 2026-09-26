namespace Hana.Infrastructure.Catalog;

/// <summary>
/// Moderated catalog identity, not a seller-specific offer, price, or stock.
/// </summary>
public sealed class ProductRecord
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public CategoryRecord Category { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Kind { get; set; } = CatalogProductKinds.Good;
    public string? Description { get; set; }
    public string State { get; set; } = PublicationStates.Draft;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? PrimaryMediaAssetId { get; set; }
}

public static class PublicationStates
{
    public const string Draft = "DRAFT";
    public const string Published = "PUBLISHED";
}

public static class CatalogProductKinds
{
    public const string Good = "GOOD";
    public const string Service = "SERVICE";
}
