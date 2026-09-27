using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Organization;

/// <summary>Organization domain data and an independent migration history.</summary>
public sealed class HanaOrganizationDbContext(
    DbContextOptions<HanaOrganizationDbContext> options) : DbContext(options)
{
    public DbSet<OrganizationRecord> Organizations => Set<OrganizationRecord>();
    public DbSet<OrganizationMembershipRecord> Memberships => Set<OrganizationMembershipRecord>();
    public DbSet<OrganizationProgramRecord> Programs => Set<OrganizationProgramRecord>();
    public DbSet<OrganizationFundingInstructionRecord> FundingInstructions => Set<OrganizationFundingInstructionRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("organization");
        modelBuilder.Entity<OrganizationRecord>(entity =>
        {
            entity.ToTable("organizations", table =>
                table.HasCheckConstraint("ck_organizations_name", "char_length(btrim(name)) BETWEEN 1 AND 160"));
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
            entity.ToTable("memberships", table =>
            {
                table.HasCheckConstraint("ck_organization_memberships_role",
                    "role IN ('ORG_LEAD','ORG_REPRESENTATIVE','ORG_TECHNICAL_OPERATOR')");
                table.HasCheckConstraint("ck_organization_memberships_revocation",
                    "(revoked_at_utc IS NULL AND revoked_by_account_id IS NULL) OR (revoked_at_utc IS NOT NULL AND revoked_by_account_id IS NOT NULL AND revoked_at_utc >= granted_at_utc)");
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
            entity.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_memberships_organizations");
            entity.HasIndex(x => new { x.OrganizationId, x.AccountId })
                .HasDatabaseName("ix_organization_memberships_org_account");
            entity.HasIndex(x => new { x.OrganizationId, x.AccountId }).IsUnique()
                .HasFilter("revoked_at_utc IS NULL")
                .HasDatabaseName("ux_organization_memberships_active_account");
            entity.HasIndex(x => x.GrantKey).IsUnique().HasDatabaseName("ux_organization_memberships_grant_key");
            entity.HasIndex(x => x.RevokeKey).IsUnique().HasDatabaseName("ux_organization_memberships_revoke_key");
        });
        modelBuilder.Entity<OrganizationProgramRecord>(entity =>
        {
            entity.ToTable("programs", table =>
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
            entity.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_programs_organizations");
            entity.HasIndex(x => new { x.OrganizationId, x.CreatedAtUtc })
                .HasDatabaseName("ix_organization_programs_org_created_at");
            entity.HasIndex(x => x.CreationKey).IsUnique()
                .HasDatabaseName("ux_organization_programs_creation_key");
        });
        modelBuilder.Entity<OrganizationFundingInstructionRecord>(entity =>
        {
            entity.ToTable("funding_instructions", table =>
            {
                table.HasCheckConstraint("ck_organization_funding_instructions_reference",
                    "char_length(btrim(source_instruction_reference)) BETWEEN 1 AND 160");
                table.HasCheckConstraint("ck_organization_funding_instructions_mode",
                    "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.HasCheckConstraint("ck_organization_funding_instructions_state",
                    "state = 'PENDING_VERIFICATION' AND program_revision = 1 AND revision = 1");
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
            entity.HasOne<OrganizationProgramRecord>().WithMany().HasForeignKey(x => x.ProgramId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_organization_funding_instructions_programs");
            entity.HasIndex(x => x.ProgramId).IsUnique()
                .HasDatabaseName("ux_organization_funding_instructions_program");
            entity.HasIndex(x => x.CreationKey).IsUnique()
                .HasDatabaseName("ux_organization_funding_instructions_creation_key");
        });
    }
}
