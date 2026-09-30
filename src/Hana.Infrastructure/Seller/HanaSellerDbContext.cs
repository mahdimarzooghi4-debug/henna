using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Seller;

/// <summary>
/// Seller module schema and independent EF migration history, sharing the
/// configured PostgreSQL instance but not the Identity model.
/// </summary>
public sealed class HanaSellerDbContext(DbContextOptions<HanaSellerDbContext> options)
    : DbContext(options)
{
    public DbSet<SellerRegistrationDraft> RegistrationDrafts =>
        Set<SellerRegistrationDraft>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("seller");
        modelBuilder.Entity<SellerRegistrationDraft>(entity =>
        {
            entity.ToTable("registration_drafts", table =>
            {
                table.HasCheckConstraint("ck_registration_drafts_status",
                    "status IN ('DRAFT', 'SUBMITTED')");
                table.HasCheckConstraint("ck_registration_drafts_revision",
                    "revision >= 1");
                table.HasCheckConstraint("ck_registration_submission_metadata",
                    "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL) OR (status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL)");
            });
            entity.HasKey(x => x.AccountId);
            entity.Property(x => x.AccountId).HasColumnName("account_id")
                .ValueGeneratedNever();
            entity.Property(x => x.StoreName).HasColumnName("store_name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.OwnerName).HasColumnName("owner_name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Phone).HasColumnName("phone")
                .HasMaxLength(11).IsRequired();
            entity.Property(x => x.City).HasColumnName("city")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Address).HasColumnName("address")
                .HasMaxLength(500).IsRequired();
            entity.Property(x => x.PostalCode).HasColumnName("postal_code")
                .HasMaxLength(10).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status")
                .HasMaxLength(16).IsRequired();
            entity.Property(x => x.Revision).HasColumnName("revision")
                .HasDefaultValue(1).IsRequired();
            entity.Property(x => x.SubmissionKey).HasColumnName("submission_key");
            entity.Property(x => x.SubmissionExpectedRevision)
                .HasColumnName("submission_expected_revision");
            entity.Property(x => x.SubmittedAtUtc).HasColumnName("submitted_at_utc");
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
        });
    }
}
