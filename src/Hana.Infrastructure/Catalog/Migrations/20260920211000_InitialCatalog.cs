using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Catalog.Migrations;

[DbContext(typeof(HanaCatalogDbContext))]
[Migration("20260920211000_InitialCatalog")]
public sealed class InitialCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "catalog");
        migrationBuilder.CreateTable(
            name: "categories", schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                slug = table.Column<string>(type: "character varying(100)",
                    maxLength: 100, nullable: false),
                state = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false, defaultValue: "DRAFT"),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_catalog_categories", x => x.id);
                table.CheckConstraint("ck_catalog_categories_state",
                    "state IN ('DRAFT', 'PUBLISHED')");
                table.CheckConstraint("ck_catalog_categories_name",
                    "length(btrim(name)) > 0");
                table.CheckConstraint("ck_catalog_categories_slug",
                    "length(btrim(slug)) > 0");
            });

        migrationBuilder.CreateTable(
            name: "products", schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                category_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)",
                    maxLength: 200, nullable: false),
                kind = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false),
                description = table.Column<string>(type: "character varying(2000)",
                    maxLength: 2000, nullable: true),
                state = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false, defaultValue: "DRAFT"),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_catalog_products", x => x.id);
                table.CheckConstraint("ck_catalog_products_state",
                    "state IN ('DRAFT', 'PUBLISHED')");
                table.CheckConstraint("ck_catalog_products_kind",
                    "kind IN ('GOOD', 'SERVICE')");
                table.CheckConstraint("ck_catalog_products_name",
                    "length(btrim(name)) > 0");
                table.ForeignKey("fk_catalog_products_categories",
                    x => x.category_id, principalSchema: "catalog",
                    principalTable: "categories", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_catalog_categories_slug", schema: "catalog",
            table: "categories", column: "slug", unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_catalog_categories_public", schema: "catalog",
            table: "categories", columns: ["state", "name", "id"]);
        migrationBuilder.CreateIndex(
            name: "ix_catalog_products_category", schema: "catalog",
            table: "products", column: "category_id");
        migrationBuilder.CreateIndex(
            name: "ix_catalog_products_public_category", schema: "catalog",
            table: "products",
            columns: ["state", "category_id", "name", "id"]);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "products", schema: "catalog");
        migrationBuilder.DropTable(name: "categories", schema: "catalog");
    }
}
