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
        migrationBuilder.CreateTable(
            name: "recipient_imports",
            schema: "organization",
            columns: table => new
            {
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                import_key = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                batch_fingerprint = table.Column<string>(
                    type: "character varying(64)", maxLength: 64, nullable: false),
                row_count = table.Column<int>(type: "integer", nullable: false),
                created_by_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey(
                    "PK_recipient_imports",
                    x => new { x.organization_id, x.import_key });
                table.CheckConstraint(
                    "ck_organization_recipient_imports_key",
                    "import_key <> '00000000-0000-0000-0000-000000000000'::uuid");
                table.CheckConstraint(
                    "ck_organization_recipient_imports_fingerprint",
                    "batch_fingerprint ~ '^[0-9a-f]{64}$'");
                table.CheckConstraint(
                    "ck_organization_recipient_imports_row_count",
                    "row_count >= 1 AND row_count <= 500");
                table.ForeignKey(
                    name: "fk_organization_recipient_imports_organizations",
                    column: x => x.organization_id,
                    principalSchema: "organization",
                    principalTable: "organizations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_organization_recipient_imports_programs",
                    columns: x => new { x.program_id, x.organization_id },
                    principalSchema: "organization",
                    principalTable: "programs",
                    principalColumns: new[] { "id", "organization_id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.AddForeignKey(
            name: "fk_organization_recipient_imports_created_by_identity_accounts",
            schema: "organization",
            table: "recipient_imports",
            column: "created_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);

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
        migrationBuilder.DropTable(
            name: "recipient_imports",
            schema: "organization");

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
