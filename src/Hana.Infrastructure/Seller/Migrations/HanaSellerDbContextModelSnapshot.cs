using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
public sealed class HanaSellerDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasDefaultSchema("seller");
        modelBuilder.Entity<SellerRegistrationDraft>(entity =>
        {
            entity.ToTable("registration_drafts", "seller", table =>
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
                table.HasCheckConstraint("ck_registration_submitted_completed",
                    "status <> 'SUBMITTED' OR completed_step = 6");
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
