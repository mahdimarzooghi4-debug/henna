namespace Hana.Infrastructure.Catalog;

/// <summary>
/// Curated taxonomy only. No seller availability or commercial offer lives here.
/// </summary>
public sealed class CategoryRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string State { get; set; } = PublicationStates.Draft;
    public DateTimeOffset CreatedAtUtc { get; set; }
}
