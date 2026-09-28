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
        modelBuilder.Entity<BuyerPurchaseDraftRecord>(entity =>
        {
            entity.ToTable("purchase_drafts", "buyer", table =>
            {
                table.HasCheckConstraint("ck_buyer_purchase_drafts_revision", "revision BETWEEN 1 AND 9007199254740991");
                table.HasCheckConstraint("ck_buyer_purchase_drafts_seller", "(is_deleted AND seller_public_id = '00000000-0000-0000-0000-000000000000') OR (NOT is_deleted AND seller_public_id <> '00000000-0000-0000-0000-000000000000')");
                table.HasCheckConstraint("ck_buyer_purchase_drafts_lines", "jsonb_typeof(lines_json) = 'array' AND ((is_deleted AND jsonb_array_length(lines_json) = 0) OR (NOT is_deleted AND jsonb_array_length(lines_json) BETWEEN 1 AND 100))");
            });
            entity.HasKey(x => x.AccountId);
            entity.Property(x => x.AccountId).HasColumnName("account_id").ValueGeneratedNever();
            entity.Property(x => x.Revision).HasColumnName("revision");
            entity.Property(x => x.SellerPublicId).HasColumnName("seller_public_id");
            entity.Property(x => x.LinesJson).HasColumnName("lines_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            entity.HasOne<AccountRecord>().WithMany().HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_buyer_purchase_drafts_accounts");
        });
        modelBuilder.Entity<BuyerPurchaseDraftIdempotencyRecord>(entity =>
        {
            entity.ToTable("purchase_draft_idempotency", "buyer", table =>
            {
                table.HasCheckConstraint("ck_buyer_purchase_draft_idempotency_key", "idempotency_key <> '00000000-0000-0000-0000-000000000000'");
                table.HasCheckConstraint("ck_buyer_purchase_draft_idempotency_hash", "char_length(request_sha256) = 64");
                table.HasCheckConstraint("ck_buyer_purchase_draft_idempotency_response", "jsonb_typeof(response_json) = 'object'");
                table.HasCheckConstraint("ck_buyer_purchase_draft_idempotency_status", "response_status_code BETWEEN 200 AND 299");
            });
            entity.HasKey(x => new { x.AccountId, x.Key });
            entity.Property(x => x.AccountId).HasColumnName("account_id").ValueGeneratedNever();
            entity.Property(x => x.Key).HasColumnName("idempotency_key").ValueGeneratedNever();
            entity.Property(x => x.RequestSha256).HasColumnName("request_sha256").HasMaxLength(64).IsRequired();
            entity.Property(x => x.ResponseJson).HasColumnName("response_json").HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.ResponseStatusCode).HasColumnName("response_status_code");
            entity.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc");
            entity.HasOne<AccountRecord>().WithMany().HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_buyer_purchase_draft_idempotency_accounts");
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
