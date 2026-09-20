using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Hana.Infrastructure.Geography.Migrations;

[DbContext(typeof(HanaGeographyDbContext))]
public sealed class HanaGeographyDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasDefaultSchema("geography");

        modelBuilder.Entity<ProvinceRecord>(entity =>
        {
            entity.ToTable("provinces", "geography", table =>
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
            entity.ToTable("cities", "geography", table =>
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
    }
}
