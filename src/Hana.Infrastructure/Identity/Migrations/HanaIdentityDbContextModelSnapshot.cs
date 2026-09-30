using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
public sealed class HanaIdentityDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasDefaultSchema("identity");

        modelBuilder.Entity<AccountRecord>(entity =>
        {
            entity.ToTable("accounts", "identity");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.NormalizedPhone).HasColumnName("normalized_phone")
                .HasMaxLength(11).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            entity.Property(x => x.PhoneVerifiedAtUtc).HasColumnName("phone_verified_at_utc");
            entity.HasIndex(x => x.NormalizedPhone).IsUnique()
                .HasDatabaseName("ix_accounts_normalized_phone");
        });

        modelBuilder.Entity<OtpChallengeRecord>(entity =>
        {
            entity.ToTable("otp_challenges", "identity", table =>
            {
                table.HasCheckConstraint("ck_otp_challenges_attempts_nonnegative",
                    "failed_attempt_count >= 0");
                table.HasCheckConstraint("ck_otp_challenges_expiry",
                    "expires_at_utc > issued_at_utc");
                table.HasCheckConstraint("ck_otp_delivery_state",
                    "delivery_status IN ('PENDING', 'ACCEPTED', 'FAILED')");
                table.HasCheckConstraint("ck_otp_accepted_has_reference",
                    "delivery_status <> 'ACCEPTED' OR provider_message_reference IS NOT NULL");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.NormalizedPhone).HasColumnName("normalized_phone")
                .HasMaxLength(11).IsRequired();
            entity.Property(x => x.CodeDigest).HasColumnName("code_digest")
                .HasMaxLength(32).IsRequired();
            entity.Property(x => x.IssuedAtUtc).HasColumnName("issued_at_utc").IsRequired();
            entity.Property(x => x.ExpiresAtUtc).HasColumnName("expires_at_utc").IsRequired();
            entity.Property(x => x.FailedAttemptCount).HasColumnName("failed_attempt_count");
            entity.Property(x => x.ConsumedAtUtc).HasColumnName("consumed_at_utc");
            entity.Property(x => x.ProviderMessageReference)
                .HasColumnName("provider_message_reference").HasMaxLength(160);
            entity.Property(x => x.DeliveryStatus).HasColumnName("delivery_status")
                .HasMaxLength(16).HasDefaultValue(OtpDeliveryStates.Pending).IsRequired();
            entity.HasIndex(x => new { x.NormalizedPhone, x.IssuedAtUtc })
                .HasDatabaseName("ix_otp_challenges_phone_issued");
        });
        modelBuilder.Entity<OtpIpRateWindowRecord>(entity =>
        {
            entity.ToTable("otp_ip_windows", "identity", table =>
            {
                table.HasCheckConstraint("ck_otp_ip_windows_action",
                    "action IN ('REQUEST', 'VERIFY')");
                table.HasCheckConstraint("ck_otp_ip_windows_count",
                    "request_count >= 1");
            });
            entity.HasKey(x => new { x.PartitionDigest, x.Action });
            entity.Property(x => x.PartitionDigest).HasColumnName("partition_digest")
                .HasMaxLength(32).IsRequired();
            entity.Property(x => x.Action).HasColumnName("action")
                .HasMaxLength(8).IsRequired();
            entity.Property(x => x.WindowStartedAtUtc)
                .HasColumnName("window_started_at_utc").IsRequired();
            entity.Property(x => x.RequestCount).HasColumnName("request_count")
                .IsRequired();
            entity.HasIndex(x => x.WindowStartedAtUtc)
                .HasDatabaseName("ix_otp_ip_windows_started");
        });
        modelBuilder.Entity<RoleAssignmentRecord>(entity =>
        {
            entity.ToTable("role_assignments", "identity", table =>
            {
                table.HasCheckConstraint("ck_role_assignments_role",
                    "role IN ('ADMIN','SELLER')");
            });
            entity.HasKey(x => new { x.AccountId, x.Role });
            entity.Property(x => x.AccountId).HasColumnName("account_id");
            entity.Property(x => x.Role).HasColumnName("role")
                .HasMaxLength(32).IsRequired();
            entity.Property(x => x.GrantedAtUtc).HasColumnName("granted_at_utc")
                .IsRequired();
            entity.HasOne<AccountRecord>().WithMany()
                .HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_role_assignments_accounts_account_id");
        });

        modelBuilder.Entity<AuthSessionRecord>(entity =>
        {
            entity.ToTable("auth_sessions", "identity", table =>
            {
                table.HasCheckConstraint("ck_auth_sessions_expiry",
                    "expires_at_utc > issued_at_utc");
                table.HasCheckConstraint("ck_auth_sessions_revocation",
                    "revoked_at_utc IS NULL OR revoked_at_utc >= issued_at_utc");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.AccountId).HasColumnName("account_id").IsRequired();
            entity.Property(x => x.TokenDigest).HasColumnName("token_digest")
                .HasMaxLength(32).IsRequired();
            entity.Property(x => x.IssuedAtUtc).HasColumnName("issued_at_utc").IsRequired();
            entity.Property(x => x.ExpiresAtUtc).HasColumnName("expires_at_utc").IsRequired();
            entity.Property(x => x.RevokedAtUtc).HasColumnName("revoked_at_utc");
            entity.HasIndex(x => x.TokenDigest).IsUnique()
                .HasDatabaseName("ix_auth_sessions_digest");
            entity.HasIndex(x => new { x.AccountId, x.ExpiresAtUtc })
                .HasDatabaseName("ix_auth_sessions_account_expiry");
            entity.HasOne<AccountRecord>().WithMany()
                .HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_auth_sessions_accounts_account_id");
        });

    }
}
