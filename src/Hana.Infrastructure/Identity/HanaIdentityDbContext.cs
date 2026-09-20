using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Isolated Identity module persistence; no orders, finance, or organization
/// entities share this context or its migration history.
/// </summary>
public sealed class HanaIdentityDbContext(DbContextOptions<HanaIdentityDbContext> options)
    : DbContext(options)
{
    public DbSet<AccountRecord> Accounts => Set<AccountRecord>();
    public DbSet<OtpChallengeRecord> OtpChallenges => Set<OtpChallengeRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("identity");

        modelBuilder.Entity<AccountRecord>(entity =>
        {
            entity.ToTable("accounts");
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
            entity.ToTable("otp_challenges", table =>
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
    }
}
