using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
public sealed class HanaOrganizationDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasDefaultSchema("organization");
        modelBuilder.Entity<OrganizationRecord>(entity =>
        {
            entity.ToTable("organizations", "organization", table => table.HasCheckConstraint("ck_organizations_name", "char_length(btrim(name)) BETWEEN 1 AND 160"));
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(160).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            entity.Property(x => x.CreatedByAccountId).HasColumnName("created_by_account_id").IsRequired();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key").IsRequired();
            entity.HasIndex(x => x.Name).HasDatabaseName("ix_organizations_name");
            entity.HasIndex(x => x.CreationKey).IsUnique().HasDatabaseName("ux_organizations_creation_key");
        });
        modelBuilder.Entity<OrganizationMembershipRecord>(entity =>
        {
            entity.ToTable("memberships", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_memberships_role", "role IN ('ORG_LEAD','ORG_REPRESENTATIVE','ORG_TECHNICAL_OPERATOR')");
                table.HasCheckConstraint("ck_organization_memberships_revocation", "(revoked_at_utc IS NULL AND revoked_by_account_id IS NULL) OR (revoked_at_utc IS NOT NULL AND revoked_by_account_id IS NOT NULL AND revoked_at_utc >= granted_at_utc)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
            entity.Property(x => x.AccountId).HasColumnName("account_id").IsRequired();
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(40).IsRequired();
            entity.Property(x => x.GrantedByAccountId).HasColumnName("granted_by_account_id").IsRequired();
            entity.Property(x => x.GrantedAtUtc).HasColumnName("granted_at_utc").IsRequired();
            entity.Property(x => x.RevokedByAccountId).HasColumnName("revoked_by_account_id");
            entity.Property(x => x.RevokedAtUtc).HasColumnName("revoked_at_utc");
            entity.Property(x => x.GrantKey).HasColumnName("grant_key").IsRequired();
            entity.Property(x => x.RevokeKey).HasColumnName("revoke_key");
            entity.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_memberships_organizations");
            entity.HasIndex(x => new { x.OrganizationId, x.AccountId }).HasDatabaseName("ix_organization_memberships_org_account");
            entity.HasIndex(x => new { x.OrganizationId, x.AccountId }).IsUnique().HasFilter("revoked_at_utc IS NULL").HasDatabaseName("ux_organization_memberships_active_account");
            entity.HasIndex(x => x.GrantKey).IsUnique().HasDatabaseName("ux_organization_memberships_grant_key");
            entity.HasIndex(x => x.RevokeKey).IsUnique().HasDatabaseName("ux_organization_memberships_revoke_key");
        });
        modelBuilder.Entity<OrganizationProgramRecord>(entity =>
        {
            entity.ToTable("programs", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_programs_name", "char_length(btrim(name)) BETWEEN 1 AND 120");
                table.HasCheckConstraint("ck_organization_programs_allocation_mode", "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.HasCheckConstraint("ck_organization_programs_description", "char_length(description) <= 1200");
                table.HasCheckConstraint("ck_organization_programs_state", "state = 'DRAFT' AND revision = 1");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            entity.Property(x => x.AllocationMode).HasColumnName("allocation_mode").HasMaxLength(32).IsRequired();
            entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(1200).IsRequired();
            entity.Property(x => x.State).HasColumnName("state").HasMaxLength(16).IsRequired();
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            entity.Property(x => x.CreatedByAccountId).HasColumnName("created_by_account_id").IsRequired();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key").IsRequired();
            entity.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_programs_organizations");
            entity.HasIndex(x => new { x.OrganizationId, x.CreatedAtUtc }).HasDatabaseName("ix_organization_programs_org_created_at");
            entity.HasIndex(x => x.CreationKey).IsUnique().HasDatabaseName("ux_organization_programs_creation_key");
        });
        modelBuilder.Entity<OrganizationFundingInstructionRecord>(entity =>
        {
            entity.ToTable("funding_instructions", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_funding_instructions_reference", "char_length(btrim(source_instruction_reference)) BETWEEN 1 AND 160");
                table.HasCheckConstraint("ck_organization_funding_instructions_mode", "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.HasCheckConstraint("ck_organization_funding_instructions_state", "state IN ('PENDING_VERIFICATION','VERIFIED','REJECTED') AND program_revision = 1 AND revision >= 1");
                table.HasCheckConstraint("ck_organization_funding_instructions_review", "(state = 'PENDING_VERIFICATION' AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL AND review_reason IS NULL) OR (state = 'VERIFIED' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL) OR (state = 'REJECTED' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND review_reason IS NOT NULL AND char_length(btrim(review_reason)) BETWEEN 1 AND 1000)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ProgramId).HasColumnName("program_id").IsRequired();
            entity.Property(x => x.ProgramRevision).HasColumnName("program_revision").IsRequired();
            entity.Property(x => x.AllocationMode).HasColumnName("allocation_mode").HasMaxLength(32).IsRequired();
            entity.Property(x => x.SourceInstructionReference).HasColumnName("source_instruction_reference").HasMaxLength(160).IsRequired();
            entity.Property(x => x.State).HasColumnName("state").HasMaxLength(32).IsRequired();
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired();
            entity.Property(x => x.SubmittedAtUtc).HasColumnName("submitted_at_utc").IsRequired();
            entity.Property(x => x.SubmittedByAccountId).HasColumnName("submitted_by_account_id").IsRequired();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key").IsRequired();
            entity.Property(x => x.ReviewedByAccountId).HasColumnName("reviewed_by_account_id");
            entity.Property(x => x.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
            entity.Property(x => x.ReviewReason).HasColumnName("review_reason").HasMaxLength(1000);
            entity.HasOne<OrganizationProgramRecord>().WithMany().HasForeignKey(x => x.ProgramId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_funding_instructions_programs");
            entity.HasIndex(x => x.ProgramId).IsUnique().HasDatabaseName("ux_organization_funding_instructions_program");
            entity.HasIndex(x => x.CreationKey).IsUnique().HasDatabaseName("ux_organization_funding_instructions_creation_key");
        });
        modelBuilder.Entity<OrganizationFundingInstructionEventRecord>(entity =>
        {
            entity.ToTable("funding_instruction_events", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_funding_instruction_events_revision", "revision >= 2");
                table.HasCheckConstraint("ck_organization_funding_instruction_events_type", "event_type IN ('VERIFIED','REJECTED','RESUBMITTED')");
                table.HasCheckConstraint("ck_organization_funding_instruction_events_reason", "event_type <> 'REJECTED' OR (reason IS NOT NULL AND char_length(btrim(reason)) BETWEEN 1 AND 1000)");
                table.HasCheckConstraint("ck_organization_funding_instruction_events_reference", "char_length(btrim(source_instruction_reference)) BETWEEN 1 AND 160");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.FundingInstructionId).HasColumnName("funding_instruction_id").IsRequired();
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired();
            entity.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(16).IsRequired();
            entity.Property(x => x.SourceInstructionReference).HasColumnName("source_instruction_reference").HasMaxLength(160).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(1000);
            entity.Property(x => x.ActorAccountId).HasColumnName("actor_account_id").IsRequired();
            entity.Property(x => x.OccurredAtUtc).HasColumnName("occurred_at_utc").IsRequired();
            entity.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").IsRequired();
            entity.HasOne<OrganizationFundingInstructionRecord>().WithMany().HasForeignKey(x => x.FundingInstructionId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_funding_instruction_events_instructions");
            entity.HasIndex(x => new { x.FundingInstructionId, x.Revision }).IsUnique().HasDatabaseName("ux_organization_funding_instruction_events_revision");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique().HasDatabaseName("ux_organization_funding_instruction_events_idempotency_key");
        });
        modelBuilder.Entity<OrganizationHouseholdReferralRecord>(entity =>
        {
            entity.ToTable("household_referrals", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_household_referrals_reference", "char_length(btrim(external_reference)) BETWEEN 1 AND 120");
                table.HasCheckConstraint("ck_organization_household_referrals_settlement", "settlement_type IN ('URBAN','RURAL')");
                table.HasCheckConstraint("ck_organization_household_referrals_housing_tenure", "housing_tenure IS NULL OR housing_tenure IN ('OWNER','TENANT')");
                table.HasCheckConstraint("ck_organization_household_referrals_health_burden", "health_burden_level IS NULL OR health_burden_level IN ('NO_ONGOING_TREATMENT','ONE_MANAGEABLE_ONGOING_CASE','HIGH_COST_OR_LIMITING_OR_MULTIPLE_MANAGEABLE_CASES','SEVERE_ONGOING_CARE_OR_MULTIPLE_HIGH_BURDEN_CASES')");
                table.HasCheckConstraint("ck_organization_household_referrals_economic_hardship", "economic_hardship_level IS NULL OR economic_hardship_level IN ('ESSENTIAL_NEEDS_GENERALLY_MET','OCCASIONAL_SHORTFALL_IN_ONE_ESSENTIAL_NEED','RECURRENT_SHORTFALL_OR_ESSENTIAL_DEBT','MULTIPLE_ESSENTIAL_NEEDS_UNMET_OR_SEVERE_INSTABILITY')");
                table.HasCheckConstraint("ck_organization_household_referrals_care_support", "care_support_level IS NULL OR care_support_level IN ('EFFECTIVE_ADULT_OR_PRACTICAL_SUPPORT_AVAILABLE','ONE_RESPONSIBLE_ADULT_WITHOUT_DEPENDENTS','LONE_CAREGIVER_WITH_ONE_DEPENDENT_OR_LIMITED_SUPPORT','NO_PRACTICAL_SUPPORT_WITH_MULTIPLE_DEPENDENTS_OR_HIGH_CARE_BURDEN')");
                table.HasCheckConstraint("ck_organization_household_referrals_education_attainment", "education_attainment IS NULL OR education_attainment IN ('BACHELOR_OR_HIGHER','DIPLOMA_OR_ASSOCIATE','BELOW_DIPLOMA_WITH_FORMAL_EDUCATION','NO_LITERACY_OR_FORMAL_EDUCATION')");
                table.HasCheckConstraint("ck_organization_household_referrals_revision", "revision = 1");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
            entity.Property(x => x.ProgramId).HasColumnName("program_id").IsRequired();
            entity.Property(x => x.ExternalReference).HasColumnName("external_reference").HasMaxLength(120).IsRequired();
            entity.Property(x => x.ProvinceId).HasColumnName("province_id").IsRequired();
            entity.Property(x => x.CityId).HasColumnName("city_id");
            entity.Property(x => x.SettlementType).HasColumnName("settlement_type").HasMaxLength(8).IsRequired();
            entity.Property(x => x.HousingTenure).HasColumnName("housing_tenure").HasMaxLength(8);
            entity.Property(x => x.HealthBurdenLevel).HasColumnName("health_burden_level").HasMaxLength(64);
            entity.Property(x => x.EconomicHardshipLevel).HasColumnName("economic_hardship_level").HasMaxLength(64);
            entity.Property(x => x.CareSupportLevel).HasColumnName("care_support_level").HasMaxLength(80);
            entity.Property(x => x.EducationAttainment).HasColumnName("education_attainment").HasMaxLength(40);
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired();
            entity.Property(x => x.SubmittedAtUtc).HasColumnName("submitted_at_utc").IsRequired();
            entity.Property(x => x.SubmittedByAccountId).HasColumnName("submitted_by_account_id").IsRequired();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key").IsRequired();
            entity.HasOne<OrganizationProgramRecord>().WithMany().HasForeignKey(x => x.ProgramId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_household_referrals_programs");
            entity.HasIndex(x => x.ProgramId).HasDatabaseName("ix_organization_household_referrals_program");
            entity.HasIndex(x => new { x.OrganizationId, x.ProgramId, x.ExternalReference }).IsUnique().HasDatabaseName("ux_organization_household_referrals_external_reference");
            entity.HasIndex(x => x.CreationKey).IsUnique().HasDatabaseName("ux_organization_household_referrals_creation_key");
        });
        modelBuilder.Entity<OrganizationHouseholdMemberRecord>(entity =>
        {
            entity.ToTable("household_members", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_household_members_number", "member_number BETWEEN 1 AND 20");
                table.HasCheckConstraint("ck_organization_household_members_gender", "gender_category IN ('FEMALE','MALE','NOT_REPORTED')");
                table.HasCheckConstraint("ck_organization_household_members_life_stage", "life_stage IN ('INFANT','PRESCHOOL','SCHOOL_AGE','ADULT','OLDER_ADULT')");
                table.HasCheckConstraint("ck_organization_household_members_education", "education_level IN ('NO_FORMAL_EDUCATION','PRIMARY','SECONDARY','DIPLOMA','HIGHER_EDUCATION','NOT_REPORTED')");
                table.HasCheckConstraint("ck_organization_household_members_health", "health_need IN ('NO_KNOWN_CHRONIC_NEED','CHRONIC_NEED','NOT_REPORTED')");
                table.HasCheckConstraint("ck_organization_household_members_practical_support", "needs_practical_support IS NULL OR life_stage = 'OLDER_ADULT' OR needs_practical_support = FALSE");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.HouseholdReferralId).HasColumnName("household_referral_id").IsRequired();
            entity.Property(x => x.MemberNumber).HasColumnName("member_number").IsRequired();
            entity.Property(x => x.GenderCategory).HasColumnName("gender_category").HasMaxLength(16).IsRequired();
            entity.Property(x => x.LifeStage).HasColumnName("life_stage").HasMaxLength(16).IsRequired();
            entity.Property(x => x.EducationLevel).HasColumnName("education_level").HasMaxLength(24).IsRequired();
            entity.Property(x => x.HealthNeed).HasColumnName("health_need").HasMaxLength(32).IsRequired();
            entity.Property(x => x.NeedsPracticalSupport).HasColumnName("needs_practical_support");
            entity.HasOne<OrganizationHouseholdReferralRecord>().WithMany().HasForeignKey(x => x.HouseholdReferralId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_organization_household_members_referrals");
            entity.HasIndex(x => new { x.HouseholdReferralId, x.MemberNumber }).IsUnique().HasDatabaseName("ux_organization_household_members_number");
        });
        modelBuilder.Entity<OrganizationAllocationPreviewRecord>(entity =>
        {
            entity.ToTable("allocation_previews", "organization", table =>
            {
                table.HasCheckConstraint("ck_organization_allocation_previews_revision", "program_revision = 1");
                table.HasCheckConstraint("ck_organization_allocation_previews_mode", "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.HasCheckConstraint("ck_organization_allocation_previews_source", "funding_source = 'ORGANIZATION'");
                table.HasCheckConstraint("ck_organization_allocation_previews_instruction_state", "funding_instruction_state IN ('PENDING_VERIFICATION','VERIFIED')");
                table.HasCheckConstraint("ck_organization_allocation_previews_state", "state = 'PREVIEW_ONLY'");
                table.HasCheckConstraint("ck_organization_allocation_previews_hash", "payload_sha256 ~ '^[a-f0-9]{64}$'");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
            entity.Property(x => x.ProgramId).HasColumnName("program_id").IsRequired();
            entity.Property(x => x.ProgramRevision).HasColumnName("program_revision").IsRequired();
            entity.Property(x => x.FundingInstructionId).HasColumnName("funding_instruction_id").IsRequired();
            entity.Property(x => x.AllocationMode).HasColumnName("allocation_mode").HasMaxLength(32).IsRequired();
            entity.Property(x => x.FundingSource).HasColumnName("funding_source").HasMaxLength(32).IsRequired();
            entity.Property(x => x.FundingSourceReference).HasColumnName("funding_source_reference").HasMaxLength(160).IsRequired();
            entity.Property(x => x.InstructionReference).HasColumnName("instruction_reference").HasMaxLength(160).IsRequired();
            entity.Property(x => x.FundingInstructionState).HasColumnName("funding_instruction_state").HasMaxLength(32).IsRequired();
            entity.Property(x => x.State).HasColumnName("state").HasMaxLength(24).IsRequired();
            entity.Property(x => x.PayloadSha256).HasColumnName("payload_sha256").HasMaxLength(64).IsRequired();
            entity.Property(x => x.SnapshotJson).HasColumnName("snapshot_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            entity.Property(x => x.CreatedByAccountId).HasColumnName("created_by_account_id").IsRequired();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key").IsRequired();
            entity.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_allocation_previews_organizations");
            entity.HasOne<OrganizationProgramRecord>().WithMany().HasForeignKey(x => x.ProgramId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_allocation_previews_programs");
            entity.HasOne<OrganizationFundingInstructionRecord>().WithMany().HasForeignKey(x => x.FundingInstructionId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_allocation_previews_funding_instructions");
            entity.HasIndex(x => x.OrganizationId).HasDatabaseName("ix_allocation_previews_organization_id");
            entity.HasIndex(x => x.FundingInstructionId).HasDatabaseName("ix_allocation_previews_funding_instruction_id");
            entity.HasIndex(x => x.CreationKey).IsUnique().HasDatabaseName("ux_organization_allocation_previews_creation_key");
            entity.HasIndex(x => new { x.ProgramId, x.CreatedAtUtc, x.Id }).HasDatabaseName("ix_organization_allocation_previews_program_created");
        });
    }
}
