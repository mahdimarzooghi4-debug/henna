namespace Hana.Infrastructure.Seller;

/// <summary>
/// Reviewed seller-onboarding business taxonomy. This is independent from
/// product catalog categories; no implicit mapping is allowed.
/// </summary>
public sealed class SellerBusinessCategoryRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
