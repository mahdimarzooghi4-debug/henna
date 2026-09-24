using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924213000_OrganizationRecipientBulkImport")]
public sealed class OrganizationRecipientBulkImport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "import_key",
            schema: "organization",
            table: "recipients",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "import_row_number",
            schema: "organization",
            table: "recipients",
            type: "integer",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_recipients_import_pair",
            schema: "organization",
            table: "recipients",
            sql: "(import_key IS NULL AND import_row_number IS NULL) OR (import_key IS NOT NULL AND import_key <> '00000000-0000-0000-0000-000000000000'::uuid AND import_row_number >= 2)");

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_org_import_row",
            schema: "organization",
            table: "recipients",
            columns: new[]
            {
                "organization_id", "import_key", "import_row_number"
            },
            unique: true,
            filter: "import_key IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_organization_recipients_org_import_row",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_recipients_import_pair",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "import_key",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "import_row_number",
            schema: "organization",
            table: "recipients");
    }
}
