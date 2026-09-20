namespace Hana.Infrastructure.Geography;

/// <summary>
/// Canonical city identity scoped to a province. Seller service coverage,
/// exact address, zone, order eligibility and launch readiness are separate.
/// </summary>
public sealed class CityRecord
{
    public Guid Id { get; set; }
    public Guid ProvinceId { get; set; }
    public ProvinceRecord Province { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string State { get; set; } = GeographyStates.Draft;
}
