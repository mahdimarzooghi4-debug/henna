using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Hana.Infrastructure.Catalog.Migrations;

[DbContext(typeof(HanaCatalogDbContext))]
public sealed class HanaCatalogDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasDefaultSchema("catalog");

        modelBuilder.Entity<CategoryRecord>(entity =>
        {
            entity.ToTable("categories", "catalog", table =>
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
            entity.ToTable("products", "catalog", table =>
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
            entity.HasIndex(x => x.CategoryId)
                .HasDatabaseName("ix_catalog_products_category");
            entity.HasIndex(x => new { x.State, x.CategoryId, x.Name, x.Id })
                .HasDatabaseName("ix_catalog_products_public_category");
        });
    }
}
