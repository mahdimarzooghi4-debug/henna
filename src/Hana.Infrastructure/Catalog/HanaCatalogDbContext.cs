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
            entity.HasOne(x => x.Category).WithMany()
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_catalog_products_categories");
            entity.HasIndex(x => new { x.State, x.CategoryId, x.Name, x.Id })
                .HasDatabaseName("ix_catalog_products_public_category");
        });
    }
}
