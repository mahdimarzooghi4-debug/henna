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
    public DbSet<OrganizationProgramRecord> Programs =>
        Set<OrganizationProgramRecord>();
    public DbSet<OrganizationRecipientRecord> Recipients =>
        Set<OrganizationRecipientRecord>();
    public DbSet<OrganizationRecipientImportRecord> RecipientImports =>
        Set<OrganizationRecipientImportRecord>();

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

        modelBuilder.Entity<OrganizationProgramRecord>(entity =>
        {
            entity.ToTable("programs", table =>
            {
                table.HasCheckConstraint("ck_organization_programs_name",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint("ck_organization_programs_kind",
                    "length(btrim(kind)) > 0");
                table.HasCheckConstraint("ck_organization_programs_allocation_method",
                    "length(btrim(allocation_method)) > 0");
                table.HasCheckConstraint("ck_organization_programs_beneficiary_source",
                    "length(btrim(beneficiary_source)) > 0");
                table.HasCheckConstraint("ck_organization_programs_status",
                    "status IN ('DRAFT', 'REGISTERED', 'ACTIVE', 'PAUSED', 'ENDED')");
                table.HasCheckConstraint("ck_organization_programs_revision",
                    "revision >= 1");
                table.HasCheckConstraint("ck_organization_programs_creation_key",
                    "creation_key IS NULL OR creation_key <> '00000000-0000-0000-0000-000000000000'::uuid");
                table.HasCheckConstraint("ck_organization_programs_creation_fingerprint",
                    "(creation_key IS NULL AND creation_fingerprint IS NULL) OR (creation_key IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}$')");
                table.HasCheckConstraint("ck_organization_programs_registration_key",
                    "registration_key IS NULL OR registration_key <> '00000000-0000-0000-0000-000000000000'::uuid");
                table.HasCheckConstraint("ck_organization_programs_registration_pair",
                    "(registration_key IS NULL AND registration_expected_revision IS NULL) OR (registration_key IS NOT NULL AND registration_expected_revision >= 1)");
            });
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.Id, x.OrganizationId })
                .HasName("ak_organization_programs_id_organization_id");
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id")
                .ValueGeneratedNever();
            entity.Property(x => x.Name).HasColumnName("name")
                .HasMaxLength(200).IsRequired();
            entity.Property(x => x.Kind).HasColumnName("kind")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.AllocationMethod).HasColumnName("allocation_method")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.BeneficiarySource).HasColumnName("beneficiary_source")
                .HasMaxLength(120).IsRequired();
            entity.Property(x => x.Description).HasColumnName("description")
                .HasMaxLength(2000);
            entity.Property(x => x.Status).HasColumnName("status")
                .HasMaxLength(16).IsRequired()
                .HasDefaultValue(OrganizationProgramStates.Draft);
            entity.Property(x => x.Revision).HasColumnName("revision")
                .HasDefaultValue(1).IsRequired().IsConcurrencyToken();
            entity.Property(x => x.CreationKey).HasColumnName("creation_key");
            entity.Property(x => x.CreationFingerprint)
                .HasColumnName("creation_fingerprint").HasMaxLength(64);
            entity.Property(x => x.CreatedByAccountId)
                .HasColumnName("created_by_account_id");
            entity.Property(x => x.UpdatedByAccountId)
                .HasColumnName("updated_by_account_id");
            entity.Property(x => x.RegistrationKey)
                .HasColumnName("registration_key");
            entity.Property(x => x.RegistrationExpectedRevision)
                .HasColumnName("registration_expected_revision");
            entity.Property(x => x.RegisteredByAccountId)
                .HasColumnName("registered_by_account_id");
            entity.Property(x => x.RegisteredAtUtc)
                .HasColumnName("registered_at_utc");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.HasOne<OrganizationRecord>().WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_programs_organizations");
            entity.HasIndex(x => new
                { x.OrganizationId, x.Status, x.CreatedAtUtc, x.Id })
                .HasDatabaseName("ix_organization_programs_org_status_created");
            entity.HasIndex(x => new { x.OrganizationId, x.CreationKey })
                .IsUnique()
                .HasFilter("creation_key IS NOT NULL")
                .HasDatabaseName("ix_organization_programs_org_creation_key");
        });

        modelBuilder.Entity<OrganizationRecipientRecord>(entity =>
        {
            entity.ToTable("recipients", table =>
            {
                table.HasCheckConstraint("ck_organization_recipients_display_name",
                    "length(btrim(display_name)) > 0");
                table.HasCheckConstraint("ck_organization_recipients_reference_masked",
                    "length(btrim(reference_masked)) > 0");
                table.HasCheckConstraint("ck_organization_recipients_reference_fingerprint",
                    "reference_fingerprint IS NULL OR reference_fingerprint ~ '^[0-9a-f]{64}$'");
                table.HasCheckConstraint("ck_organization_recipients_creation_key",
                    "creation_key IS NULL OR creation_key <> '00000000-0000-0000-0000-000000000000'::uuid");
                table.HasCheckConstraint("ck_organization_recipients_creation_fingerprint",
                    "(creation_key IS NULL AND creation_fingerprint IS NULL) OR (creation_key IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}$')");
                table.HasCheckConstraint("ck_organization_recipients_import_pair",
                    "(import_key IS NULL AND import_row_number IS NULL) OR (import_key IS NOT NULL AND import_key <> '00000000-0000-0000-0000-000000000000'::uuid AND import_row_number >= 2)");
                table.HasCheckConstraint("ck_organization_recipients_source",
                    "source IN ('MANUAL', 'API')");
                table.HasCheckConstraint("ck_organization_recipients_match_status",
                    "match_status IN ('MATCHED', 'NEEDS_MATCH', 'PENDING_REVIEW')");
                table.HasCheckConstraint("ck_organization_recipients_match_account",
                    "(match_status = 'MATCHED' AND matched_account_id IS NOT NULL) OR (match_status <> 'MATCHED' AND matched_account_id IS NULL)");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id")
                .ValueGeneratedNever();
            entity.Property(x => x.ProgramId).HasColumnName("program_id")
                .ValueGeneratedNever();
            entity.Property(x => x.DisplayName).HasColumnName("display_name")
                .HasMaxLength(200).IsRequired();
            entity.Property(x => x.ReferenceMasked)
                .HasColumnName("reference_masked").HasMaxLength(80).IsRequired();
            entity.Property(x => x.ReferenceFingerprint)
                .HasColumnName("reference_fingerprint").HasMaxLength(64);
            entity.Property(x => x.CreationKey)
                .HasColumnName("creation_key");
            entity.Property(x => x.CreationFingerprint)
                .HasColumnName("creation_fingerprint").HasMaxLength(64);
            entity.Property(x => x.CreatedByAccountId)
                .HasColumnName("created_by_account_id");
            entity.Property(x => x.ImportKey)
                .HasColumnName("import_key");
            entity.Property(x => x.ImportRowNumber)
                .HasColumnName("import_row_number");
            entity.Property(x => x.Source).HasColumnName("source")
                .HasMaxLength(16).IsRequired();
            entity.Property(x => x.MatchStatus).HasColumnName("match_status")
                .HasMaxLength(24).IsRequired();
            entity.Property(x => x.MatchedAccountId)
                .HasColumnName("matched_account_id");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc")
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();

            entity.HasOne<OrganizationRecord>().WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_recipients_organizations");
            entity.HasOne<OrganizationProgramRecord>().WithMany()
                .HasForeignKey(x => new { x.ProgramId, x.OrganizationId })
                .HasPrincipalKey(x => new { x.Id, x.OrganizationId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_recipients_programs");

            entity.HasIndex(x => new
                { x.OrganizationId, x.ProgramId, x.CreatedAtUtc, x.Id })
                .HasDatabaseName("ix_organization_recipients_org_program_created");
            // Explicitly model the composite FK index. EF creates this by
            // convention because the FK order is ProgramId, OrganizationId;
            // keeping it explicit makes snapshot/migration drift impossible.
            entity.HasIndex(x => new { x.ProgramId, x.OrganizationId })
                .HasDatabaseName("ix_organization_recipients_program_tenant");
            entity.HasIndex(x => new
                { x.OrganizationId, x.MatchStatus, x.Source, x.CreatedAtUtc, x.Id })
                .HasDatabaseName("ix_organization_recipients_org_match_source_created");
            entity.HasIndex(x => new
                { x.OrganizationId, x.ProgramId, x.ReferenceFingerprint })
                .IsUnique()
                .HasFilter("reference_fingerprint IS NOT NULL")
                .HasDatabaseName("ix_organization_recipients_org_program_reference");
            entity.HasIndex(x => new { x.OrganizationId, x.CreationKey })
                .IsUnique()
                .HasFilter("creation_key IS NOT NULL")
                .HasDatabaseName("ix_organization_recipients_org_creation_key");
            entity.HasIndex(x => new
                { x.OrganizationId, x.ImportKey, x.ImportRowNumber })
                .IsUnique()
                .HasFilter("import_key IS NOT NULL")
                .HasDatabaseName("ix_organization_recipients_org_import_row");
        });

        modelBuilder.Entity<OrganizationRecipientImportRecord>(entity =>
        {
            entity.ToTable("recipient_imports", table =>
            {
                table.HasCheckConstraint(
                    "ck_organization_recipient_imports_key",
                    "import_key <> '00000000-0000-0000-0000-000000000000'::uuid");
                table.HasCheckConstraint(
                    "ck_organization_recipient_imports_fingerprint",
                    "batch_fingerprint ~ '^[0-9a-f]{64}$'");
                table.HasCheckConstraint(
                    "ck_organization_recipient_imports_row_count",
                    "row_count >= 1 AND row_count <= 500");
            });
            entity.HasKey(x => new { x.OrganizationId, x.ImportKey });
            entity.Property(x => x.OrganizationId)
                .HasColumnName("organization_id").ValueGeneratedNever();
            entity.Property(x => x.ImportKey)
                .HasColumnName("import_key").ValueGeneratedNever();
            entity.Property(x => x.ProgramId)
                .HasColumnName("program_id").ValueGeneratedNever();
            entity.Property(x => x.BatchFingerprint)
                .HasColumnName("batch_fingerprint").HasMaxLength(64)
                .IsRequired();
            entity.Property(x => x.RowCount)
                .HasColumnName("row_count").IsRequired();
            entity.Property(x => x.CreatedByAccountId)
                .HasColumnName("created_by_account_id").IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasColumnName("created_at_utc").IsRequired();

            entity.HasOne<OrganizationRecord>().WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName(
                    "fk_organization_recipient_imports_organizations");
            entity.HasOne<OrganizationProgramRecord>().WithMany()
                .HasForeignKey(x => new { x.ProgramId, x.OrganizationId })
                .HasPrincipalKey(x => new { x.Id, x.OrganizationId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName(
                    "fk_organization_recipient_imports_programs");
        });
    }
}
