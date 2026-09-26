using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926084000_SellerOfferDrafts")]
public sealed class SellerOfferDrafts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "offer_drafts",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                seller_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                catalog_product_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                status = table.Column<string>(
                    type: "character varying(16)",
                    maxLength: 16, nullable: false),
                revision = table.Column<int>(
                    type: "integer", nullable: false),
                idempotency_key = table.Column<Guid>(
                    type: "uuid", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_offer_drafts", x => x.id);
                table.CheckConstraint("ck_offer_drafts_revision",
                    "revision >= 1");
                table.CheckConstraint("ck_offer_drafts_status",
                    "status = 'DRAFT'");
                table.ForeignKey(
                    name: "fk_offer_drafts_registration_drafts_seller",
                    column: x => x.seller_account_id,
                    principalSchema: "seller",
                    principalTable: "registration_drafts",
                    principalColumn: "account_id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ux_offer_drafts_seller_idempotency",
            schema: "seller",
            table: "offer_drafts",
            columns: new[] { "seller_account_id", "idempotency_key" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_offer_drafts_seller_created",
            schema: "seller",
            table: "offer_drafts",
            columns: new[] { "seller_account_id", "created_at_utc", "id" });

        migrationBuilder.CreateIndex(
            name: "ix_offer_drafts_catalog_product",
            schema: "seller",
            table: "offer_drafts",
            column: "catalog_product_id");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "offer_drafts",
            schema: "seller");
    }
}
