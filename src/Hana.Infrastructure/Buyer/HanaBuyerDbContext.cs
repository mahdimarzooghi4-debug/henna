using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Buyer;

public sealed class HanaBuyerDbContext(DbContextOptions<HanaBuyerDbContext> options)
    : DbContext(options)
{
    public DbSet<BuyerReferenceCartRecord> ReferenceCarts =>
        Set<BuyerReferenceCartRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("buyer");
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
        modelBuilder.Entity<BuyerReferenceCartRecord>(entity =>
        {
            entity.ToTable("reference_carts", table =>
            {
                table.HasCheckConstraint("ck_buyer_reference_carts_revision",
                    "revision BETWEEN 1 AND 9007199254740991");
                table.HasCheckConstraint("ck_buyer_reference_carts_items",
                    "jsonb_typeof(items_json) = 'array'");
            });
            entity.HasKey(x => x.AccountId);
            entity.Property(x => x.AccountId).HasColumnName("account_id")
                .ValueGeneratedNever();
            entity.Property(x => x.Revision).HasColumnName("revision").IsRequired();
            entity.Property(x => x.ItemsJson).HasColumnName("items_json")
                .HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc")
                .IsRequired();
            entity.HasOne<AccountRecord>().WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_buyer_reference_carts_accounts");
        });
    }
}
