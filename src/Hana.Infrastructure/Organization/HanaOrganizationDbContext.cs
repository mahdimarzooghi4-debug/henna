using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Organization;

/// <summary>
/// Independent Organization module persistence and migration history.
/// Identity account IDs are authorization references; no identity secrets are
/// duplicated into this schema.
/// </summary>
public sealed class HanaOrganizationDbContext(
    DbContextOptions<HanaOrganizationDbContext> options) : DbContext(options)
{
    public DbSet<OrganizationRecord> Organizations => Set<OrganizationRecord>();
    public DbSet<OrganizationMembershipRecord> Memberships =>
        Set<OrganizationMembershipRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("organization");

        modelBuilder.Entity<OrganizationRecord>(entity =>
        {
            entity.ToTable("organizations", table =>
            {
                table.HasCheckConstraint("ck_organizations_name",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint("ck_organizations_type",
                    "length(btrim(organization_type)) > 0");
                table.HasCheckConstraint("ck_organizations_allocation_method",
                    "length(btrim(default_allocation_method)) > 0");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(200).IsRequired();
            entity.Property(x => x.OrganizationType).HasColumnName("organization_type")
                .HasMaxLength(80).IsRequired();
            entity.Property(x => x.DefaultAllocationMethod)
                .HasColumnName("default_allocation_method")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Phone).HasColumnName("phone")
                .HasMaxLength(32);
            entity.Property(x => x.Email).HasColumnName("email")
                .HasMaxLength(254);
            entity.Property(x => x.Address).HasColumnName("address")
                .HasMaxLength(500);
            entity.Property(x => x.RepresentativeName)
                .HasColumnName("representative_name").HasMaxLength(160);
            entity.Property(x => x.RepresentativePhone)
                .HasColumnName("representative_phone").HasMaxLength(32);
            entity.Property(x => x.VerifiedAtUtc).HasColumnName("verified_at_utc");
            entity.Property(x => x.IsActive).HasColumnName("is_active")
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.HasIndex(x => new { x.IsActive, x.Name, x.Id })
                .HasDatabaseName("ix_organizations_active_name");
        });

        modelBuilder.Entity<OrganizationMembershipRecord>(entity =>
        {
            entity.ToTable("memberships", table =>
            {
                table.HasCheckConstraint("ck_organization_membership_role",
                    "length(btrim(role)) > 0");
            });
            entity.HasKey(x => new { x.OrganizationId, x.AccountId });
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id")
                .ValueGeneratedNever();
            entity.Property(x => x.AccountId).HasColumnName("account_id")
                .ValueGeneratedNever();
            entity.Property(x => x.Role).HasColumnName("role")
                .HasMaxLength(64).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active")
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.HasOne<OrganizationRecord>().WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_memberships_organizations");
            // The current portal has no organization switcher. Fail closed at
            // the data model: one account can have at most one active portal
            // membership until a deliberate multi-org UX is designed.
            entity.HasIndex(x => x.AccountId).IsUnique()
                .HasFilter("is_active = TRUE")
                .HasDatabaseName("ix_organization_memberships_active_account");
        });
    }
}
