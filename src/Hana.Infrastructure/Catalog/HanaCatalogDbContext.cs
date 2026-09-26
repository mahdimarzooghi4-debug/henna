using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Catalog;

/// <summary>
/// Separate Catalog model and migration history. No pricing/inventory or
/// seller state may be derived from publication of a catalog identity.
/// </summary>
public sealed class HanaCatalogDbContext(DbContextOptions<HanaCatalogDbContext> options)
    : DbContext(options)
{
    public DbSet<CategoryRecord> Categories => Set<CategoryRecord>();
    public DbSet<ProductRecord> Products => Set<ProductRecord>();
    public DbSet<CatalogImportReceipt> ImportReceipts =>
        Set<CatalogImportReceipt>();
    public DbSet<CatalogMediaAssetRecord> MediaAssets =>
        Set<CatalogMediaAssetRecord>();
    public DbSet<CatalogMediaReviewRecord> MediaReviews =>
        Set<CatalogMediaReviewRecord>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("catalog");

        modelBuilder.Entity<CategoryRecord>(entity =>
        {
            entity.ToTable("categories", table =>
            {
                table.HasCheckConstraint("ck_catalog_categories_state",
                    "state IN ('DRAFT', 'PUBLISHED')");
                table.HasCheckConstraint("ck_catalog_categories_name",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint("ck_catalog_categories_slug",
                    "length(btrim(slug)) > 0");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Slug).HasColumnName("slug")
                .HasMaxLength(100).IsRequired();
            entity.Property(x => x.State).HasColumnName("state")
                .HasMaxLength(16).IsRequired().HasDefaultValue(PublicationStates.Draft);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique()
                .HasDatabaseName("ix_catalog_categories_slug");
            entity.HasIndex(x => new { x.State, x.Name, x.Id })
                .HasDatabaseName("ix_catalog_categories_public");
        });

        modelBuilder.Entity<ProductRecord>(entity =>
        {
            entity.ToTable("products", table =>
            {
                table.HasCheckConstraint("ck_catalog_products_state",
                    "state IN ('DRAFT', 'PUBLISHED')");
                table.HasCheckConstraint("ck_catalog_products_kind",
                    "kind IN ('GOOD', 'SERVICE')");
                table.HasCheckConstraint("ck_catalog_products_name",
                    "length(btrim(name)) > 0");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.CategoryId).HasColumnName("category_id")
                .IsRequired();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(200).IsRequired();
            entity.Property(x => x.Kind).HasColumnName("kind")
                .HasMaxLength(16).IsRequired();
            entity.Property(x => x.Description).HasColumnName("description")
                .HasMaxLength(2000);
            entity.Property(x => x.State).HasColumnName("state")
                .HasMaxLength(16).IsRequired().HasDefaultValue(PublicationStates.Draft);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.Property(x => x.PrimaryMediaAssetId)
                .HasColumnName("primary_media_asset_id");
            entity.HasOne(x => x.Category).WithMany()
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_catalog_products_categories");
            entity.HasIndex(x => x.CategoryId)
                .HasDatabaseName("ix_catalog_products_category");
            entity.HasIndex(x => new { x.State, x.CategoryId, x.Name, x.Id })
                .HasDatabaseName("ix_catalog_products_public_category");
            entity.HasIndex(x => x.PrimaryMediaAssetId)
                .HasDatabaseName("ix_catalog_products_primary_media_asset");
            entity.HasOne<CatalogMediaAssetRecord>().WithMany()
                .HasForeignKey(x => x.PrimaryMediaAssetId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_catalog_products_primary_media_asset");
        });

        modelBuilder.Entity<CatalogMediaAssetRecord>(entity =>
        {
            entity.ToTable("media_assets", table =>
            {
                table.HasCheckConstraint("ck_catalog_media_asset_status",
                    "review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')");
                table.HasCheckConstraint("ck_catalog_media_asset_content_type",
                    "content_type IN ('image/jpeg', 'image/png', 'image/webp')");
                table.HasCheckConstraint("ck_catalog_media_asset_sha256",
                    "content_sha256 ~ '^[a-f0-9]{64}$'");
                table.HasCheckConstraint("ck_catalog_media_asset_length",
                    "length_bytes BETWEEN 1 AND 5242880");
                table.HasCheckConstraint("ck_catalog_media_asset_revision",
                    "revision >= 1");
                table.HasCheckConstraint("ck_catalog_media_asset_review",
                    "(review_status = 'PENDING_REVIEW' AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                    "(review_status <> 'PENDING_REVIEW' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL)");
                table.HasCheckConstraint("ck_catalog_media_asset_reason",
                    "review_status <> 'REJECTED' OR (review_reason IS NOT NULL AND length(btrim(review_reason)) > 0)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ProductId).HasColumnName("product_id").IsRequired();
            entity.Property(x => x.ObjectKey).HasColumnName("object_key").HasMaxLength(300).IsRequired();
            entity.Property(x => x.ContentType).HasColumnName("content_type").HasMaxLength(32).IsRequired();
            entity.Property(x => x.ContentSha256).HasColumnName("content_sha256").HasMaxLength(64).IsRequired();
            entity.Property(x => x.LengthBytes).HasColumnName("length_bytes").IsRequired();
            entity.Property(x => x.ReviewStatus).HasColumnName("review_status")
                .HasMaxLength(24).IsRequired().HasDefaultValue(CatalogMediaReviewStates.Pending);
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired().HasDefaultValue(1);
            entity.Property(x => x.UploadedByAccountId).HasColumnName("uploaded_by_account_id").IsRequired();
            entity.Property(x => x.UploadIdempotencyKey).HasColumnName("upload_idempotency_key").IsRequired();
            entity.Property(x => x.UploadedAtUtc).HasColumnName("uploaded_at_utc").IsRequired();
            entity.Property(x => x.ReviewedByAccountId).HasColumnName("reviewed_by_account_id");
            entity.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
            entity.Property(x => x.ReviewReason).HasColumnName("review_reason").HasMaxLength(1000);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_catalog_media_assets_products");
            entity.HasIndex(x => new { x.UploadedByAccountId, x.UploadIdempotencyKey })
                .IsUnique().HasDatabaseName("ux_catalog_media_assets_upload_key");
            entity.HasIndex(x => new { x.ProductId, x.ReviewStatus })
                .HasDatabaseName("ix_catalog_media_assets_product_status");
        });

        modelBuilder.Entity<CatalogMediaReviewRecord>(entity =>
        {
            entity.ToTable("media_reviews", table =>
            {
                table.HasCheckConstraint("ck_catalog_media_review_decision",
                    "decision IN ('APPROVED', 'REJECTED')");
                table.HasCheckConstraint("ck_catalog_media_review_revision",
                    "expected_revision >= 1");
                table.HasCheckConstraint("ck_catalog_media_review_reason",
                    "decision <> 'REJECTED' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.AssetId).HasColumnName("asset_id").IsRequired();
            entity.Property(x => x.ExpectedRevision).HasColumnName("expected_revision").IsRequired();
            entity.Property(x => x.Decision).HasColumnName("decision").HasMaxLength(16).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(1000);
            entity.Property(x => x.ReviewedByAccountId).HasColumnName("reviewed_by_account_id").IsRequired();
            entity.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").IsRequired();
            entity.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc").IsRequired();
            entity.HasOne<CatalogMediaAssetRecord>().WithMany().HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_catalog_media_reviews_asset");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique()
                .HasDatabaseName("ux_catalog_media_reviews_idempotency_key");
            entity.HasIndex(x => new { x.AssetId, x.ReviewedAtUtc, x.Id })
                .HasDatabaseName("ix_catalog_media_reviews_asset_reviewed");
        });

        modelBuilder.Entity<CatalogImportReceipt>(entity =>
        {
            entity.ToTable("import_receipts", table =>
            {
                table.HasCheckConstraint("ck_catalog_receipt_digest",
                    "content_sha256 ~ '^[a-f0-9]{64}$'");
                table.HasCheckConstraint("ck_catalog_receipt_counts",
                    "new_parents >= 0 AND changed_parents >= 0 AND " +
                    "new_children >= 0 AND changed_children >= 0");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(x => x.ContentSha256)
                .HasColumnName("content_sha256")
                .HasMaxLength(64).IsRequired();
            entity.Property(x => x.AppliedAtUtc)
                .HasColumnName("applied_at_utc").IsRequired();
            entity.Property(x => x.NewParents)
                .HasColumnName("new_parents").IsRequired();
            entity.Property(x => x.ChangedParents)
                .HasColumnName("changed_parents").IsRequired();
            entity.Property(x => x.NewChildren)
                .HasColumnName("new_children").IsRequired();
            entity.Property(x => x.ChangedChildren)
                .HasColumnName("changed_children").IsRequired();
            entity.HasIndex(x => new { x.AppliedAtUtc, x.Id })
                .HasDatabaseName("ix_catalog_receipt_applied");
            entity.HasIndex(x => x.ContentSha256)
                .HasDatabaseName("ix_catalog_receipt_digest");
        });
    }
}
