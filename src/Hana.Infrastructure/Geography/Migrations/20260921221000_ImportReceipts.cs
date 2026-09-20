using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Geography.Migrations;

[DbContext(typeof(HanaGeographyDbContext))]
[Migration("20260921221000_ImportReceipts")]
public sealed class ImportReceipts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "import_receipts", schema: "geography",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                content_sha256 = table.Column<string>(
                    type: "character varying(64)", maxLength: 64,
                    nullable: false),
                applied_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                new_parents = table.Column<int>(type: "integer", nullable: false),
                changed_parents = table.Column<int>(type: "integer", nullable: false),
                new_children = table.Column<int>(type: "integer", nullable: false),
                changed_children = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_geography_import_receipts", x => x.id);
                table.CheckConstraint("ck_geography_receipt_digest",
                    "content_sha256 ~ '^[a-f0-9]{64}$'");
                table.CheckConstraint("ck_geography_receipt_counts",
                    "new_parents >= 0 AND changed_parents >= 0 AND " +
                    "new_children >= 0 AND changed_children >= 0");
            });
        migrationBuilder.CreateIndex(
            name: "ix_geography_receipt_applied", schema: "geography",
            table: "import_receipts",
            columns: ["applied_at_utc", "id"]);
        migrationBuilder.CreateIndex(
            name: "ix_geography_receipt_digest", schema: "geography",
            table: "import_receipts", column: "content_sha256");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "import_receipts", schema: "geography");
    }
}
