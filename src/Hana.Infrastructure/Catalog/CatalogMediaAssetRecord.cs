namespace Hana.Infrastructure.Catalog;

public sealed class CatalogMediaAssetRecord
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public ProductRecord Product { get; set; } = null!;
    public string ObjectKey { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public string ContentSha256 { get; set; } = null!;
    public long LengthBytes { get; set; }
    public string ReviewStatus { get; set; } = CatalogMediaReviewStates.Pending;
    public int Revision { get; set; } = 1;
    public Guid UploadedByAccountId { get; set; }
    public Guid UploadIdempotencyKey { get; set; }
    public DateTimeOffset UploadedAtUtc { get; set; }
    public Guid? ReviewedByAccountId { get; set; }
    public DateTimeOffset? ReviewedAtUtc { get; set; }
    public string? ReviewReason { get; set; }
}

public sealed class CatalogMediaReviewRecord
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public int ExpectedRevision { get; set; }
    public string Decision { get; set; } = null!;
    public string? Reason { get; set; }
    public Guid ReviewedByAccountId { get; set; }
    public Guid IdempotencyKey { get; set; }
    public DateTimeOffset ReviewedAtUtc { get; set; }
}

public static class CatalogMediaReviewStates
{
    public const string Pending = "PENDING_REVIEW";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class CatalogMediaStorageLimits
{
    public const int MaxImageBytes = 5 * 1024 * 1024;
}
