using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260925230000_BusinessInformationStep")]
public sealed class BusinessInformationStep : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "business_category_import_receipts",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                content_sha256 = table.Column<string>(
                    type: "character varying(64)",
                    maxLength: 64,
                    nullable: false),
                applied_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone",
                    nullable: false),
                new_categories = table.Column<int>(
                    type: "integer",
                    nullable: false),
                changed_categories = table.Column<int>(
                    type: "integer",
                    nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey(
                    "pk_business_category_import_receipts",
                    x => x.id);
                table.CheckConstraint(
                    "ck_business_category_import_receipts_counts",
                    "new_categories >= 0 AND changed_categories >= 0");
            });

        migrationBuilder.CreateTable(
            name: "business_categories",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(
                    type: "character varying(120)",
                    maxLength: 120,
                    nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone",
                    nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_business_categories", x => x.id);
                table.CheckConstraint(
                    "ck_business_categories_name",
                    "char_length(btrim(name)) BETWEEN 1 AND 120");
            });

        migrationBuilder.CreateIndex(
            name: "ix_business_categories_active_name",
            schema: "seller",
            table: "business_categories",
            columns: new[] { "is_active", "name" });

        migrationBuilder.CreateIndex(
            name: "ux_business_categories_name",
            schema: "seller",
            table: "business_categories",
            column: "name",
            unique: true);

        migrationBuilder.AddColumn<Guid>(
            name: "business_category_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "business_name",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(180)",
            maxLength: 180,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "business_description",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "business_phone",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(11)",
            maxLength: 11,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "offering_type",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_offering_type",
            schema: "seller",
            table: "registration_drafts",
            sql: "offering_type IS NULL OR offering_type IN ('GOOD', 'SERVICE', 'BOTH')");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_business_shape",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(completed_step < 4 AND business_category_id IS NULL AND business_name IS NULL AND business_description IS NULL AND business_phone IS NULL AND offering_type IS NULL) OR " +
                "(completed_step >= 4 AND business_category_id IS NOT NULL AND business_name IS NOT NULL AND business_description IS NOT NULL AND business_phone IS NOT NULL AND offering_type IS NOT NULL AND " +
                "char_length(btrim(business_name)) BETWEEN 1 AND 180 AND " +
                "char_length(btrim(business_description)) BETWEEN 1 AND 500 AND " +
                "business_phone ~ '^0[0-9]{10}$' AND " +
                "offering_type IN ('GOOD', 'SERVICE', 'BOTH'))");

        migrationBuilder.CreateIndex(
            name: "ix_registration_drafts_business_category_id",
            schema: "seller",
            table: "registration_drafts",
            column: "business_category_id");

        migrationBuilder.AddForeignKey(
            name: "fk_registration_drafts_business_categories_business_category_id",
            schema: "seller",
            table: "registration_drafts",
            column: "business_category_id",
            principalSchema: "seller",
            principalTable: "business_categories",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_registration_drafts_business_categories_business_category_id",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_business_shape",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_offering_type",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropIndex(
            name: "ix_registration_drafts_business_category_id",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "business_category_id",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "business_name",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "business_description",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "business_phone",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "offering_type",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropTable(
            name: "business_category_import_receipts",
            schema: "seller");

        migrationBuilder.DropTable(
            name: "business_categories",
            schema: "seller");
    }
}
