using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260927180000_OrganizationFundingInstructions")]
public sealed class OrganizationFundingInstructions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "funding_instructions", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_revision = table.Column<int>(type: "integer", nullable: false),
                allocation_mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                source_instruction_reference = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                revision = table.Column<int>(type: "integer", nullable: false),
                submitted_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                submitted_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                creation_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_funding_instructions", x => x.id);
                table.CheckConstraint("ck_organization_funding_instructions_reference",
                    "char_length(btrim(source_instruction_reference)) BETWEEN 1 AND 160");
                table.CheckConstraint("ck_organization_funding_instructions_mode",
                    "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.CheckConstraint("ck_organization_funding_instructions_state",
                    "state = 'PENDING_VERIFICATION' AND program_revision = 1 AND revision = 1");
                table.ForeignKey("fk_organization_funding_instructions_programs", x => x.program_id,
                    principalSchema: "organization", principalTable: "programs",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(name: "ux_organization_funding_instructions_program",
            schema: "organization", table: "funding_instructions", column: "program_id", unique: true);
        migrationBuilder.CreateIndex(name: "ux_organization_funding_instructions_creation_key",
            schema: "organization", table: "funding_instructions", column: "creation_key", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "funding_instructions", schema: "organization");
}
