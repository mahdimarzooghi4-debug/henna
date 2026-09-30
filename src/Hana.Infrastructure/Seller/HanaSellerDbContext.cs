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
    public DbSet<SellerApplicationReviewRecord> ApplicationReviews =>
        Set<SellerApplicationReviewRecord>();
    public DbSet<SellerApplicationAmendmentRecord> ApplicationAmendments =>
        Set<SellerApplicationAmendmentRecord>();
    public DbSet<SellerActivationRecord> SellerActivations =>
        Set<SellerActivationRecord>();
    public DbSet<SellerBusinessCategoryRecord> BusinessCategories =>
        Set<SellerBusinessCategoryRecord>();
    public DbSet<SellerBusinessCategoryImportReceipt> BusinessCategoryImportReceipts =>
        Set<SellerBusinessCategoryImportReceipt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("seller");
        modelBuilder.Entity<SellerBusinessCategoryRecord>(entity =>
        {
            entity.ToTable("business_categories", table =>
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
            entity.ToTable("business_category_import_receipts", table =>
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
                table.HasCheckConstraint("ck_registration_offering_type",
                    "offering_type IS NULL OR offering_type IN ('GOOD', 'SERVICE', 'BOTH')");
                table.HasCheckConstraint("ck_registration_business_shape",
                    "(completed_step < 4 AND business_category_id IS NULL AND business_name IS NULL AND business_description IS NULL AND business_phone IS NULL AND offering_type IS NULL) OR " +
                    "(completed_step >= 4 AND business_category_id IS NOT NULL AND business_name IS NOT NULL AND business_description IS NOT NULL AND business_phone IS NOT NULL AND offering_type IS NOT NULL AND char_length(btrim(business_name)) BETWEEN 1 AND 180 AND char_length(btrim(business_description)) BETWEEN 1 AND 500 AND business_phone ~ '^0[0-9]{10}$' AND offering_type IN ('GOOD', 'SERVICE', 'BOTH'))");
                table.HasCheckConstraint("ck_registration_activity_shape",
                    "(completed_step < 5 AND activity_province_id IS NULL AND activity_city_id IS NULL AND activity_address IS NULL AND activity_hours IS NULL AND seller_delivery IS NULL AND pickup IS NULL AND service_area IS NULL) OR " +
                    "(completed_step >= 5 AND activity_province_id IS NOT NULL AND activity_city_id IS NOT NULL AND char_length(btrim(activity_address)) BETWEEN 1 AND 500 AND char_length(btrim(activity_hours)) BETWEEN 1 AND 180 AND seller_delivery IS NOT NULL AND pickup IS NOT NULL AND (seller_delivery OR pickup) AND char_length(btrim(service_area)) BETWEEN 1 AND 240)");
                table.HasCheckConstraint("ck_registration_additional_shape",
                    "(completed_step < 6 AND registration_contact_name IS NULL AND registration_contact_role IS NULL AND backup_phone IS NULL AND website_or_social IS NULL AND business_email IS NULL AND response_hours IS NULL) OR " +
                    "(completed_step >= 6 AND char_length(btrim(registration_contact_name)) BETWEEN 1 AND 120 AND (registration_contact_role IS NULL OR char_length(btrim(registration_contact_role)) BETWEEN 1 AND 120) AND (backup_phone IS NULL OR backup_phone ~ '^09[0-9]{9}$') AND (website_or_social IS NULL OR char_length(btrim(website_or_social)) BETWEEN 1 AND 300) AND (business_email IS NULL OR char_length(btrim(business_email)) BETWEEN 3 AND 254) AND char_length(btrim(response_hours)) BETWEEN 1 AND 180)");
                table.HasCheckConstraint("ck_registration_submitted_completed",
                    "status <> 'SUBMITTED' OR completed_step = 6 OR (completed_step = 1 AND applicant_type IS NULL)");
                table.HasCheckConstraint("ck_registration_submission_metadata",
                    "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL AND tracking_code IS NULL) OR " +
                    "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL AND tracking_code IS NOT NULL AND char_length(tracking_code) BETWEEN 8 AND 24)");
                table.HasCheckConstraint("ck_registration_review_status",
                    "(status = 'DRAFT' AND review_status IS NULL AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                    "(status = 'SUBMITTED' AND review_status IN ('UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED') AND " +
                    "((review_status = 'UNDER_REVIEW' AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                    "(review_status <> 'UNDER_REVIEW' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND " +
                    "(review_status = 'APPROVED' OR char_length(btrim(review_reason)) BETWEEN 1 AND 500))))");
                table.HasCheckConstraint("ck_registration_activation",
                    "(activated_at_utc IS NULL AND activated_by_account_id IS NULL) OR " +
                    "(status = 'SUBMITTED' AND review_status = 'APPROVED' AND activated_at_utc IS NOT NULL AND activated_by_account_id IS NOT NULL)");
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
            entity.Property(x => x.RegistrationContactName).HasColumnName("registration_contact_name")
                .HasMaxLength(120);
            entity.Property(x => x.RegistrationContactRole).HasColumnName("registration_contact_role")
                .HasMaxLength(120);
            entity.Property(x => x.BackupPhone).HasColumnName("backup_phone")
                .HasMaxLength(11);
            entity.Property(x => x.WebsiteOrSocial).HasColumnName("website_or_social")
                .HasMaxLength(300);
            entity.Property(x => x.BusinessEmail).HasColumnName("business_email")
                .HasMaxLength(254);
            entity.Property(x => x.ResponseHours).HasColumnName("response_hours")
                .HasMaxLength(180);
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
            entity.Property(x => x.AccuracyConfirmedAtUtc)
                .HasColumnName("accuracy_confirmed_at_utc");
            entity.Property(x => x.TrackingCode).HasColumnName("tracking_code")
                .HasMaxLength(24);
            entity.Property(x => x.ReviewStatus).HasColumnName("review_status")
                .HasMaxLength(32);
            entity.Property(x => x.ReviewReason).HasColumnName("review_reason")
                .HasMaxLength(500);
            entity.Property(x => x.ReviewedByAccountId)
                .HasColumnName("reviewed_by_account_id");
            entity.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
            entity.Property(x => x.ActivatedAtUtc).HasColumnName("activated_at_utc");
            entity.Property(x => x.ActivatedByAccountId)
                .HasColumnName("activated_by_account_id");
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.HasIndex(x => x.TrackingCode)
                .IsUnique()
                .HasFilter("tracking_code IS NOT NULL")
                .HasDatabaseName("ux_registration_drafts_tracking_code");
            entity.HasIndex(x => x.BusinessCategoryId)
                .HasDatabaseName("ix_registration_drafts_business_category_id");
            entity.HasOne<SellerBusinessCategoryRecord>().WithMany()
                .HasForeignKey(x => x.BusinessCategoryId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_registration_drafts_business_categories_business_category_id");
        });

        modelBuilder.Entity<SellerApplicationAmendmentRecord>(entity =>
        {
            entity.ToTable("application_amendments", table =>
            {
                table.HasCheckConstraint("ck_application_amendments_status",
                    "status IN ('OPEN','RESUBMITTED')");
                table.HasCheckConstraint("ck_application_amendments_revision",
                    "base_revision >= 1");
                table.HasCheckConstraint("ck_application_amendments_text",
                    "char_length(btrim(reviewer_reason)) BETWEEN 1 AND 500 AND char_length(btrim(response_text)) BETWEEN 1 AND 2000");
                table.HasCheckConstraint("ck_application_amendments_resubmitted",
                    "(status = 'OPEN' AND resubmitted_at_utc IS NULL) OR (status = 'RESUBMITTED' AND resubmitted_at_utc IS NOT NULL)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ApplicationAccountId)
                .HasColumnName("application_account_id").IsRequired();
            entity.Property(x => x.BaseRevision).HasColumnName("base_revision")
                .IsRequired();
            entity.Property(x => x.Status).HasColumnName("status")
                .HasMaxLength(16).IsRequired();
            entity.Property(x => x.ReviewerReason).HasColumnName("reviewer_reason")
                .HasMaxLength(500).IsRequired();
            entity.Property(x => x.ResponseText).HasColumnName("response_text")
                .HasMaxLength(2000).IsRequired();
            entity.Property(x => x.ReferenceUrl).HasColumnName("reference_url")
                .HasMaxLength(500);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.Property(x => x.ResubmittedAtUtc)
                .HasColumnName("resubmitted_at_utc");
            entity.HasIndex(x => new { x.ApplicationAccountId, x.Status })
                .HasDatabaseName("ix_application_amendments_application_status");
            entity.HasIndex(x => x.ApplicationAccountId)
                .IsUnique()
                .HasFilter("status = 'OPEN'")
                .HasDatabaseName("ux_application_amendments_open_application");
            entity.HasOne<SellerRegistrationDraft>().WithMany()
                .HasForeignKey(x => x.ApplicationAccountId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_application_amendments_registration_drafts");
        });

        modelBuilder.Entity<SellerActivationRecord>(entity =>
        {
            entity.ToTable("seller_activations", table =>
            {
                table.HasCheckConstraint("ck_seller_activations_revision",
                    "expected_revision >= 1");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ApplicationAccountId)
                .HasColumnName("application_account_id").IsRequired();
            entity.Property(x => x.ActivatedByAccountId)
                .HasColumnName("activated_by_account_id").IsRequired();
            entity.Property(x => x.ActivationKey).HasColumnName("activation_key")
                .IsRequired();
            entity.Property(x => x.ExpectedRevision)
                .HasColumnName("expected_revision").IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.HasIndex(x => x.ActivationKey).IsUnique()
                .HasDatabaseName("ux_seller_activations_activation_key");
            entity.HasIndex(x => x.ApplicationAccountId).IsUnique()
                .HasDatabaseName("ux_seller_activations_application");
            entity.HasOne<SellerRegistrationDraft>().WithMany()
                .HasForeignKey(x => x.ApplicationAccountId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_seller_activations_registration_drafts");
        });

        modelBuilder.Entity<SellerApplicationReviewRecord>(entity =>
        {
            entity.ToTable("application_reviews", table =>
            {
                table.HasCheckConstraint("ck_application_reviews_decision",
                    "decision IN ('NEEDS_INFORMATION','APPROVED','REJECTED')");
                table.HasCheckConstraint("ck_application_reviews_revision",
                    "expected_revision >= 1");
                table.HasCheckConstraint("ck_application_reviews_reason",
                    "(decision = 'APPROVED' AND (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500)) OR " +
                    "(decision IN ('NEEDS_INFORMATION','REJECTED') AND char_length(btrim(reason)) BETWEEN 1 AND 500)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ApplicationAccountId)
                .HasColumnName("application_account_id").IsRequired();
            entity.Property(x => x.ReviewerAccountId)
                .HasColumnName("reviewer_account_id").IsRequired();
            entity.Property(x => x.DecisionKey).HasColumnName("decision_key")
                .IsRequired();
            entity.Property(x => x.ExpectedRevision)
                .HasColumnName("expected_revision").IsRequired();
            entity.Property(x => x.Decision).HasColumnName("decision")
                .HasMaxLength(32).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason")
                .HasMaxLength(500);
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.HasIndex(x => x.DecisionKey).IsUnique()
                .HasDatabaseName("ux_application_reviews_decision_key");
            entity.HasIndex(x => new { x.ApplicationAccountId, x.CreatedAtUtc })
                .HasDatabaseName("ix_application_reviews_application_created");
            entity.HasOne<SellerRegistrationDraft>().WithMany()
                .HasForeignKey(x => x.ApplicationAccountId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_application_reviews_registration_drafts");
        });
    }
}
