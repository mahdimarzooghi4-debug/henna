using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Geography;

/// <summary>
/// Geography uses its own schema and migration history in the shared DB.
/// Only canonical geography lives here, never seller coverage or fulfillment.
/// </summary>
public sealed class HanaGeographyDbContext(DbContextOptions<HanaGeographyDbContext> options)
    : DbContext(options)
{
    public DbSet<ProvinceRecord> Provinces => Set<ProvinceRecord>();
    public DbSet<CityRecord> Cities => Set<CityRecord>();
    public DbSet<GeographyImportReceipt> ImportReceipts =>
        Set<GeographyImportReceipt>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("geography");

        modelBuilder.Entity<ProvinceRecord>(entity =>
        {
            entity.ToTable("provinces", table =>
            {
                table.HasCheckConstraint("ck_geo_provinces_state",
                    "state IN ('DRAFT', 'SELECTABLE')");
                table.HasCheckConstraint("ck_geo_provinces_name",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint("ck_geo_provinces_slug",
                    "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Slug).HasColumnName("slug")
                .HasMaxLength(100).IsRequired();
            entity.Property(x => x.State).HasColumnName("state")
                .HasMaxLength(16).HasDefaultValue(GeographyStates.Draft)
                .IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique()
                .HasDatabaseName("ix_geo_provinces_slug");
            entity.HasIndex(x => new { x.State, x.Name, x.Id })
                .HasDatabaseName("ix_geo_provinces_selectable");
        });

        modelBuilder.Entity<CityRecord>(entity =>
        {
            entity.ToTable("cities", table =>
            {
                table.HasCheckConstraint("ck_geo_cities_state",
                    "state IN ('DRAFT', 'SELECTABLE')");
                table.HasCheckConstraint("ck_geo_cities_name",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint("ck_geo_cities_slug",
                    "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ProvinceId).HasColumnName("province_id")
                .IsRequired();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Slug).HasColumnName("slug")
                .HasMaxLength(100).IsRequired();
            entity.Property(x => x.State).HasColumnName("state")
                .HasMaxLength(16).HasDefaultValue(GeographyStates.Draft)
                .IsRequired();
            entity.HasOne(x => x.Province).WithMany()
                .HasForeignKey(x => x.ProvinceId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_geo_cities_provinces");
            entity.HasIndex(x => x.ProvinceId)
                .HasDatabaseName("ix_geo_cities_province");
            entity.HasIndex(x => new { x.ProvinceId, x.Slug }).IsUnique()
                .HasDatabaseName("ix_geo_cities_province_slug");
            entity.HasIndex(x => new { x.State, x.ProvinceId, x.Name, x.Id })
                .HasDatabaseName("ix_geo_cities_selectable");
        });

        modelBuilder.Entity<GeographyImportReceipt>(entity =>
        {
            entity.ToTable("import_receipts", table =>
            {
                table.HasCheckConstraint("ck_geography_receipt_digest",
                    "content_sha256 ~ '^[a-f0-9]{64}$'");
                table.HasCheckConstraint("ck_geography_receipt_counts",
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
                .HasDatabaseName("ix_geography_receipt_applied");
            entity.HasIndex(x => x.ContentSha256)
                .HasDatabaseName("ix_geography_receipt_digest");
        });
    }
}
