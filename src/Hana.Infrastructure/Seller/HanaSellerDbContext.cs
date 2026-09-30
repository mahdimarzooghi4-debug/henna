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
                table.HasCheckConstraint("ck_registration_drafts_completed_step",
                    "completed_step BETWEEN 1 AND 6");
                table.HasCheckConstraint("ck_registration_drafts_applicant_type",
                    "applicant_type IS NULL OR applicant_type IN ('NATURAL', 'LEGAL')");
                table.HasCheckConstraint("ck_registration_applicant_type_step",
                    "(completed_step < 2 AND applicant_type IS NULL) OR (completed_step >= 2 AND applicant_type IS NOT NULL)");
                table.HasCheckConstraint("ck_registration_identity_status",
                    "identity_status IS NULL OR identity_status IN ('VERIFIED', 'RECORDED')");
                table.HasCheckConstraint("ck_registration_identity_shape",
                    "(completed_step < 3 AND identity_status IS NULL AND natural_national_code IS NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                    "(completed_step >= 3 AND applicant_type = 'NATURAL' AND identity_status = 'VERIFIED' AND natural_national_code IS NOT NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                    "(completed_step >= 3 AND applicant_type = 'LEGAL' AND identity_status = 'RECORDED' AND natural_national_code IS NULL AND legal_national_id IS NOT NULL AND legal_name IS NOT NULL AND legal_representative_name IS NOT NULL AND legal_representative_phone IS NOT NULL)");
                table.HasCheckConstraint("ck_registration_submitted_completed",
                    "status <> 'SUBMITTED' OR completed_step = 6 OR (completed_step = 1 AND applicant_type IS NULL)");
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
            entity.Property(x => x.ApplicantType).HasColumnName("applicant_type")
                .HasMaxLength(16);
            entity.Property(x => x.NaturalNationalCode).HasColumnName("natural_national_code")
                .HasMaxLength(10);
            entity.Property(x => x.LegalNationalId).HasColumnName("legal_national_id")
                .HasMaxLength(11);
            entity.Property(x => x.LegalName).HasColumnName("legal_name")
                .HasMaxLength(180);
            entity.Property(x => x.LegalRepresentativeName)
                .HasColumnName("legal_representative_name").HasMaxLength(120);
            entity.Property(x => x.LegalRepresentativePhone)
                .HasColumnName("legal_representative_phone").HasMaxLength(11);
            entity.Property(x => x.IdentityStatus).HasColumnName("identity_status")
                .HasMaxLength(16);
            entity.Property(x => x.CompletedStep).HasColumnName("completed_step")
                .HasDefaultValue(1).IsRequired();
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
