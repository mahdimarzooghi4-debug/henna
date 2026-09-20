using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Geography.Migrations;

[DbContext(typeof(HanaGeographyDbContext))]
[Migration("20260921010000_InitialGeography")]
public sealed class InitialGeography : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "geography");
        migrationBuilder.CreateTable(
            name: "provinces", schema: "geography",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                slug = table.Column<string>(type: "character varying(100)",
                    maxLength: 100, nullable: false),
                state = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false, defaultValue: "DRAFT")
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_geo_provinces", x => x.id);
                table.CheckConstraint("ck_geo_provinces_state",
                    "state IN ('DRAFT', 'SELECTABLE')");
                table.CheckConstraint("ck_geo_provinces_name",
                    "length(btrim(name)) > 0");
                table.CheckConstraint("ck_geo_provinces_slug",
                    "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
            });

        migrationBuilder.CreateTable(
            name: "cities", schema: "geography",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                province_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                slug = table.Column<string>(type: "character varying(100)",
                    maxLength: 100, nullable: false),
                state = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false, defaultValue: "DRAFT")
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_geo_cities", x => x.id);
                table.CheckConstraint("ck_geo_cities_state",
                    "state IN ('DRAFT', 'SELECTABLE')");
                table.CheckConstraint("ck_geo_cities_name",
                    "length(btrim(name)) > 0");
                table.CheckConstraint("ck_geo_cities_slug",
                    "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
                table.ForeignKey("fk_geo_cities_provinces",
                    x => x.province_id, principalSchema: "geography",
                    principalTable: "provinces", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_geo_provinces_slug", schema: "geography",
            table: "provinces", column: "slug", unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_geo_provinces_selectable", schema: "geography",
            table: "provinces", columns: ["state", "name", "id"]);
        migrationBuilder.CreateIndex(
            name: "ix_geo_cities_province", schema: "geography",
            table: "cities", column: "province_id");
        migrationBuilder.CreateIndex(
            name: "ix_geo_cities_province_slug", schema: "geography",
            table: "cities", columns: ["province_id", "slug"], unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_geo_cities_selectable", schema: "geography",
            table: "cities", columns: ["state", "province_id", "name", "id"]);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "cities", schema: "geography");
        migrationBuilder.DropTable(name: "provinces", schema: "geography");
    }
}
