using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Catalog.Migrations;

[DbContext(typeof(HanaCatalogDbContext))]
[Migration("20260926065000_ReviewedMediaAssets")]
public sealed class ReviewedMediaAssets : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "media_assets", schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                product_id = table.Column<Guid>(type: "uuid", nullable: false),
                object_key = table.Column<string>(type: "character varying(300)",
                    maxLength: 300, nullable: false),
                content_type = table.Column<string>(type: "character varying(32)",
                    maxLength: 32, nullable: false),
                content_sha256 = table.Column<string>(type: "character varying(64)",
                    maxLength: 64, nullable: false),
                length_bytes = table.Column<long>(type: "bigint", nullable: false),
                review_status = table.Column<string>(type: "character varying(24)",
                    maxLength: 24, nullable: false, defaultValue: "PENDING_REVIEW"),
                revision = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                uploaded_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                upload_idempotency_key = table.Column<Guid>(type: "uuid", nullable: false),
                uploaded_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                reviewed_by_account_id = table.Column<Guid>(type: "uuid", nullable: true),
                reviewed_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true),
                review_reason = table.Column<string>(type: "character varying(1000)",
                    maxLength: 1000, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_catalog_media_assets", x => x.id);
                table.CheckConstraint("ck_catalog_media_asset_status",
                    "review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')");
                table.CheckConstraint("ck_catalog_media_asset_content_type",
                    "content_type IN ('image/jpeg', 'image/png', 'image/webp')");
                table.CheckConstraint("ck_catalog_media_asset_sha256",
                    "content_sha256 ~ '^[a-f0-9]{64}$'");
                table.CheckConstraint("ck_catalog_media_asset_length",
                    "length_bytes BETWEEN 1 AND 5242880");
                table.CheckConstraint("ck_catalog_media_asset_revision",
                    "revision >= 1");
                table.CheckConstraint("ck_catalog_media_asset_review",
                    "(review_status = 'PENDING_REVIEW' AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                    "(review_status <> 'PENDING_REVIEW' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL)");
                table.CheckConstraint("ck_catalog_media_asset_reason",
                    "review_status <> 'REJECTED' OR (review_reason IS NOT NULL AND length(btrim(review_reason)) > 0)");
                table.ForeignKey("fk_catalog_media_assets_products",
                    x => x.product_id, principalSchema: "catalog",
                    principalTable: "products", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "media_reviews", schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                expected_revision = table.Column<int>(type: "integer", nullable: false),
                decision = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false),
                reason = table.Column<string>(type: "character varying(1000)",
                    maxLength: 1000, nullable: true),
                reviewed_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                idempotency_key = table.Column<Guid>(type: "uuid", nullable: false),
                reviewed_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_catalog_media_reviews", x => x.id);
                table.CheckConstraint("ck_catalog_media_review_decision",
                    "decision IN ('APPROVED', 'REJECTED')");
                table.CheckConstraint("ck_catalog_media_review_revision",
                    "expected_revision >= 1");
                table.CheckConstraint("ck_catalog_media_review_reason",
                    "decision <> 'REJECTED' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)");
                table.ForeignKey("fk_catalog_media_reviews_asset",
                    x => x.asset_id, principalSchema: "catalog",
                    principalTable: "media_assets", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.AddColumn<Guid>(
            name: "primary_media_asset_id", schema: "catalog",
            table: "products", type: "uuid", nullable: true);

        migrationBuilder.CreateIndex(
            name: "ux_catalog_media_assets_upload_key", schema: "catalog",
            table: "media_assets",
            columns: new[] { "uploaded_by_account_id", "upload_idempotency_key" },
            unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_catalog_media_assets_product_status", schema: "catalog",
            table: "media_assets", columns: new[] { "product_id", "review_status" });
        migrationBuilder.CreateIndex(
            name: "ux_catalog_media_reviews_idempotency_key", schema: "catalog",
            table: "media_reviews", column: "idempotency_key", unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_catalog_media_reviews_asset_reviewed", schema: "catalog",
            table: "media_reviews", columns: new[] { "asset_id", "reviewed_at_utc", "id" });
        migrationBuilder.CreateIndex(
            name: "ix_catalog_products_primary_media_asset", schema: "catalog",
            table: "products", column: "primary_media_asset_id");

        migrationBuilder.AddForeignKey(
            name: "fk_catalog_products_primary_media_asset",
            schema: "catalog", table: "products",
            column: "primary_media_asset_id",
            principalSchema: "catalog", principalTable: "media_assets",
            principalColumn: "id", onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_catalog_products_primary_media_asset",
            schema: "catalog", table: "products");
        migrationBuilder.DropTable(name: "media_reviews", schema: "catalog");
        migrationBuilder.DropTable(name: "media_assets", schema: "catalog");
        migrationBuilder.DropIndex(
            name: "ix_catalog_products_primary_media_asset",
            schema: "catalog", table: "products");
        migrationBuilder.DropColumn(
            name: "primary_media_asset_id", schema: "catalog",
            table: "products");
    }
}
