using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Buyer.Migrations;

[DbContext(typeof(HanaBuyerDbContext))]
public sealed class HanaBuyerDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("buyer");
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.Entity<BuyerReferenceCartRecord>(entity =>
        {
            entity.ToTable("reference_carts", "buyer", table =>
            {
                table.HasCheckConstraint("ck_buyer_reference_carts_revision", "revision BETWEEN 1 AND 9007199254740991");
                table.HasCheckConstraint("ck_buyer_reference_carts_items", "jsonb_typeof(items_json) = 'array'");
            });
            entity.HasKey(x => x.AccountId);
            entity.Property(x => x.AccountId).HasColumnName("account_id").ValueGeneratedNever();
            entity.Property(x => x.Revision).HasColumnName("revision");
            entity.Property(x => x.ItemsJson).HasColumnName("items_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasOne<AccountRecord>().WithMany().HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_buyer_reference_carts_accounts");
        });
        modelBuilder.Entity<AccountRecord>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.ToTable("accounts", "identity");
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.NormalizedPhone).HasColumnName("normalized_phone").HasMaxLength(11).IsRequired();
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            entity.Property(x => x.PhoneVerifiedAtUtc).HasColumnName("phone_verified_at_utc");
            entity.HasIndex(x => x.NormalizedPhone).IsUnique().HasDatabaseName("ix_accounts_normalized_phone");
        });
    }
}
