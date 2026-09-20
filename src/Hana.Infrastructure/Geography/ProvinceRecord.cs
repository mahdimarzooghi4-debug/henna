namespace Hana.Infrastructure.Geography;

/// <summary>
/// Location taxonomy; SELECTABLE means a location may be chosen in future
/// address flows, NOT that orders or logistics are available in this province.
/// </summary>
public sealed class ProvinceRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string State { get; set; } = GeographyStates.Draft;
}

public static class GeographyStates
{
    public const string Draft = "DRAFT";
    public const string Selectable = "SELECTABLE";
}
