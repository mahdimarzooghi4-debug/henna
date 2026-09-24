using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924193000_OrganizationRecipientsReadModel")]
public sealed class OrganizationRecipientsReadModel : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddUniqueConstraint(
            name: "ak_organization_programs_id_organization_id",
            schema: "organization",
            table: "programs",
            columns: new[] { "id", "organization_id" });

        migrationBuilder.CreateTable(
            name: "recipients",
            schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                display_name = table.Column<string>(
                    type: "character varying(200)",
                    maxLength: 200,
                    nullable: false),
                reference_masked = table.Column<string>(
                    type: "character varying(80)",
                    maxLength: 80,
                    nullable: false),
                source = table.Column<string>(
                    type: "character varying(16)",
                    maxLength: 16,
                    nullable: false),
                match_status = table.Column<string>(
                    type: "character varying(24)",
                    maxLength: 24,
                    nullable: false),
                matched_account_id = table.Column<Guid>(
                    type: "uuid",
                    nullable: true),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone",
                    nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone",
                    nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_recipients", x => x.id);
                table.CheckConstraint(
                    "ck_organization_recipients_display_name",
                    "length(btrim(display_name)) > 0");
                table.CheckConstraint(
                    "ck_organization_recipients_reference_masked",
                    "length(btrim(reference_masked)) > 0");
                table.CheckConstraint(
                    "ck_organization_recipients_source",
                    "source IN ('MANUAL', 'API')");
                table.CheckConstraint(
                    "ck_organization_recipients_match_status",
                    "match_status IN ('MATCHED', 'NEEDS_MATCH', 'PENDING_REVIEW')");
                table.CheckConstraint(
                    "ck_organization_recipients_match_account",
                    "(match_status = 'MATCHED' AND matched_account_id IS NOT NULL) OR (match_status <> 'MATCHED' AND matched_account_id IS NULL)");
                table.ForeignKey(
                    name: "fk_organization_recipients_organizations",
                    column: x => x.organization_id,
                    principalSchema: "organization",
                    principalTable: "organizations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_organization_recipients_programs",
                    columns: x => new { x.program_id, x.organization_id },
                    principalSchema: "organization",
                    principalTable: "programs",
                    principalColumns: new[] { "id", "organization_id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_org_program_created",
            schema: "organization",
            table: "recipients",
            columns: new[]
            {
                "organization_id", "program_id", "created_at_utc", "id"
            });

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_program_tenant",
            schema: "organization",
            table: "recipients",
            columns: new[] { "program_id", "organization_id" });

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_org_match_source_created",
            schema: "organization",
            table: "recipients",
            columns: new[]
            {
                "organization_id", "match_status", "source", "created_at_utc", "id"
            });

        // Identity remains an independent module. This optional FK guarantees
        // that a MATCHED recipient points to a real Hana account without
        // duplicating identity data into the Organization schema.
        migrationBuilder.AddForeignKey(
            name: "fk_organization_recipients_matched_identity_accounts",
            schema: "organization",
            table: "recipients",
            column: "matched_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "recipients",
            schema: "organization");

        migrationBuilder.DropUniqueConstraint(
            name: "ak_organization_programs_id_organization_id",
            schema: "organization",
            table: "programs");
    }
}
