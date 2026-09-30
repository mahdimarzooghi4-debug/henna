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
        modelBuilder.Entity<SellerBusinessCategoryRecord>(entity =>
        {
            entity.ToTable("business_categories", "seller", table =>
            {
                table.HasCheckConstraint("ck_business_categories_name",
                    "char_length(btrim(name)) BETWEEN 1 AND 120");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active")
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.HasIndex(x => new { x.IsActive, x.Name })
                .HasDatabaseName("ix_business_categories_active_name");
            entity.HasIndex(x => x.Name)
                .IsUnique()
                .HasDatabaseName("ux_business_categories_name");
        });

        modelBuilder.Entity<SellerBusinessCategoryImportReceipt>(entity =>
        {
            entity.ToTable("business_category_import_receipts", "seller", table =>
            {
                table.HasCheckConstraint(
                    "ck_business_category_import_receipts_counts",
                    "new_categories >= 0 AND changed_categories >= 0");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id")
                .ValueGeneratedNever();
            entity.Property(x => x.ContentSha256).HasColumnName("content_sha256")
                .HasMaxLength(64).IsRequired();
            entity.Property(x => x.AppliedAtUtc).HasColumnName("applied_at_utc")
                .IsRequired();
            entity.Property(x => x.NewCategories).HasColumnName("new_categories")
                .IsRequired();
            entity.Property(x => x.ChangedCategories).HasColumnName("changed_categories")
                .IsRequired();
        });

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
                table.HasCheckConstraint("ck_registration_identity_status",
                    "identity_status IS NULL OR identity_status IN ('VERIFIED', 'RECORDED')");
                table.HasCheckConstraint("ck_registration_identity_shape",
                    "(completed_step < 3 AND identity_status IS NULL AND natural_national_code IS NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                    "(completed_step >= 3 AND applicant_type = 'NATURAL' AND identity_status = 'VERIFIED' AND natural_national_code IS NOT NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                    "(completed_step >= 3 AND applicant_type = 'LEGAL' AND identity_status = 'RECORDED' AND natural_national_code IS NULL AND legal_national_id IS NOT NULL AND legal_name IS NOT NULL AND legal_representative_name IS NOT NULL AND legal_representative_phone IS NOT NULL)");
                table.HasCheckConstraint("ck_registration_offering_type",
                    "offering_type IS NULL OR offering_type IN ('GOOD', 'SERVICE', 'BOTH')");
                table.HasCheckConstraint("ck_registration_business_shape",
                    "(completed_step < 4 AND business_category_id IS NULL AND business_name IS NULL AND business_description IS NULL AND business_phone IS NULL AND offering_type IS NULL) OR " +
                    "(completed_step >= 4 AND business_category_id IS NOT NULL AND business_name IS NOT NULL AND business_description IS NOT NULL AND business_phone IS NOT NULL AND offering_type IS NOT NULL AND char_length(btrim(business_name)) BETWEEN 1 AND 180 AND char_length(btrim(business_description)) BETWEEN 1 AND 500 AND business_phone ~ '^0[0-9]{10}$' AND offering_type IN ('GOOD', 'SERVICE', 'BOTH'))");
                table.HasCheckConstraint("ck_registration_activity_shape",
                    "(completed_step < 5 AND activity_province_id IS NULL AND activity_city_id IS NULL AND activity_address IS NULL AND activity_hours IS NULL AND seller_delivery IS NULL AND pickup IS NULL AND service_area IS NULL) OR " +
                    "(completed_step >= 5 AND activity_province_id IS NOT NULL AND activity_city_id IS NOT NULL AND char_length(btrim(activity_address)) BETWEEN 1 AND 500 AND char_length(btrim(activity_hours)) BETWEEN 1 AND 180 AND seller_delivery IS NOT NULL AND pickup IS NOT NULL AND (seller_delivery OR pickup) AND char_length(btrim(service_area)) BETWEEN 1 AND 240)");
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
            entity.Property(x => x.BusinessCategoryId).HasColumnName("business_category_id");
            entity.Property(x => x.BusinessName).HasColumnName("business_name")
                .HasMaxLength(180);
            entity.Property(x => x.BusinessDescription).HasColumnName("business_description")
                .HasMaxLength(500);
            entity.Property(x => x.BusinessPhone).HasColumnName("business_phone")
                .HasMaxLength(11);
            entity.Property(x => x.OfferingType).HasColumnName("offering_type")
                .HasMaxLength(16);
            entity.Property(x => x.ActivityProvinceId).HasColumnName("activity_province_id");
            entity.Property(x => x.ActivityCityId).HasColumnName("activity_city_id");
            entity.Property(x => x.ActivityAddress).HasColumnName("activity_address")
                .HasMaxLength(500);
            entity.Property(x => x.ActivityHours).HasColumnName("activity_hours")
                .HasMaxLength(180);
            entity.Property(x => x.SellerDelivery).HasColumnName("seller_delivery");
            entity.Property(x => x.Pickup).HasColumnName("pickup");
            entity.Property(x => x.ServiceArea).HasColumnName("service_area")
                .HasMaxLength(240);
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
            entity.HasIndex(x => x.BusinessCategoryId)
                .HasDatabaseName("ix_registration_drafts_business_category_id");
            entity.HasOne<SellerBusinessCategoryRecord>().WithMany()
                .HasForeignKey(x => x.BusinessCategoryId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_registration_drafts_business_categories_business_category_id");
        });
    }
}
