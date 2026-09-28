using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260928143000_SellerOfferLifecycle")]
public sealed class SellerOfferLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_offer_drafts_status", schema: "seller",
            table: "offer_drafts");
        migrationBuilder.AddColumn<long>(
            name: "price_rials", schema: "seller", table: "offer_drafts",
            type: "bigint", nullable: true);
        migrationBuilder.AddColumn<decimal>(
            name: "sellable_quantity", schema: "seller", table: "offer_drafts",
            type: "numeric(18,6)", precision: 18, scale: 6, nullable: true);
        migrationBuilder.AddCheckConstraint(
            name: "ck_offer_drafts_status", schema: "seller",
            table: "offer_drafts",
            sql: "status IN ('DRAFT', 'PUBLISHED', 'PAUSED')");
        migrationBuilder.AddCheckConstraint(
            name: "ck_offer_drafts_commercial_values", schema: "seller",
            table: "offer_drafts",
            sql: "(price_rials IS NULL AND sellable_quantity IS NULL) OR " +
                "(price_rials IS NOT NULL AND price_rials > 0 AND sellable_quantity IS NOT NULL AND sellable_quantity >= 0)");
        migrationBuilder.AddCheckConstraint(
            name: "ck_offer_drafts_published_values", schema: "seller",
            table: "offer_drafts",
            sql: "status <> 'PUBLISHED' OR (price_rials IS NOT NULL AND price_rials > 0 AND sellable_quantity IS NOT NULL AND sellable_quantity > 0)");

        migrationBuilder.CreateTable(
            name: "offer_mutations", schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                offer_id = table.Column<Guid>(type: "uuid", nullable: false),
                seller_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                expected_revision = table.Column<int>(type: "integer", nullable: false),
                resulting_revision = table.Column<int>(type: "integer", nullable: false),
                action = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false),
                resulting_status = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false),
                idempotency_key = table.Column<Guid>(type: "uuid", nullable: false),
                request_sha256 = table.Column<string>(type: "character varying(64)",
                    maxLength: 64, nullable: false),
                price_rials = table.Column<long>(type: "bigint", nullable: true),
                sellable_quantity = table.Column<decimal>(type: "numeric(18,6)",
                    precision: 18, scale: 6, nullable: true),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_offer_mutations", x => x.id);
                table.CheckConstraint("ck_offer_mutations_revision",
                    "expected_revision >= 1 AND resulting_revision = expected_revision + 1");
                table.CheckConstraint("ck_offer_mutations_action",
                    "action IN ('UPDATED', 'PUBLISHED')");
                table.CheckConstraint("ck_offer_mutations_status",
                    "resulting_status IN ('DRAFT', 'PUBLISHED')");
                table.CheckConstraint("ck_offer_mutations_digest",
                    "request_sha256 ~ '^[a-f0-9]{64}$'");
                table.ForeignKey("fk_offer_mutations_offer_drafts",
                    x => x.offer_id, principalSchema: "seller",
                    principalTable: "offer_drafts", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(
            name: "ux_offer_mutations_seller_key", schema: "seller",
            table: "offer_mutations",
            columns: new[] { "seller_account_id", "idempotency_key" },
            unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_offer_mutations_offer_created", schema: "seller",
            table: "offer_mutations",
            columns: new[] { "offer_id", "created_at_utc", "id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM seller.offer_drafts WHERE status <> 'DRAFT' OR price_rials IS NOT NULL OR sellable_quantity IS NOT NULL) THEN RAISE EXCEPTION 'Seller offers contain commercial state that cannot be represented by the prior schema'; END IF; END $$;");
        migrationBuilder.DropTable(name: "offer_mutations", schema: "seller");
        migrationBuilder.DropCheckConstraint(
            name: "ck_offer_drafts_status", schema: "seller",
            table: "offer_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_offer_drafts_commercial_values", schema: "seller",
            table: "offer_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_offer_drafts_published_values", schema: "seller",
            table: "offer_drafts");
        migrationBuilder.DropColumn(
            name: "price_rials", schema: "seller", table: "offer_drafts");
        migrationBuilder.DropColumn(
            name: "sellable_quantity", schema: "seller", table: "offer_drafts");
        migrationBuilder.AddCheckConstraint(
            name: "ck_offer_drafts_status", schema: "seller",
            table: "offer_drafts", sql: "status = 'DRAFT'");
    }
}
