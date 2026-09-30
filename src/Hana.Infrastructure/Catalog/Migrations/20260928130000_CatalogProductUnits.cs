using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Catalog.Migrations;

[DbContext(typeof(HanaCatalogDbContext))]
[Migration("20260928130000_CatalogProductUnits")]
public sealed class CatalogProductUnits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "unit_name", schema: "catalog", table: "products",
            type: "character varying(40)", maxLength: 40, nullable: true);
        migrationBuilder.AddColumn<short>(
            name: "quantity_scale", schema: "catalog", table: "products",
            type: "smallint", nullable: true);
        migrationBuilder.AddCheckConstraint(
            name: "ck_catalog_products_unit_quantity",
            schema: "catalog", table: "products",
            sql: "(unit_name IS NULL AND quantity_scale IS NULL) OR " +
                "(kind = 'GOOD' AND unit_name IS NOT NULL AND length(btrim(unit_name)) BETWEEN 1 AND 40 AND quantity_scale IS NOT NULL AND quantity_scale BETWEEN 0 AND 6)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_catalog_products_unit_quantity",
            schema: "catalog", table: "products");
        migrationBuilder.DropColumn(
            name: "unit_name", schema: "catalog", table: "products");
        migrationBuilder.DropColumn(
            name: "quantity_scale", schema: "catalog", table: "products");
    }
}
