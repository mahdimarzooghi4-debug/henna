using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260929180000_OrganizationAllocationPreviews")]
public sealed class OrganizationAllocationPreviews : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "allocation_previews",
            schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_revision = table.Column<int>(type: "integer", nullable: false),
                funding_instruction_id = table.Column<Guid>(type: "uuid", nullable: false),
                allocation_mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                funding_source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                funding_source_reference = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                instruction_reference = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                funding_instruction_state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                state = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                payload_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                snapshot_json = table.Column<string>(type: "jsonb", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                created_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                creation_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_allocation_previews", x => x.id);
                table.CheckConstraint("ck_organization_allocation_previews_revision", "program_revision = 1");
                table.CheckConstraint("ck_organization_allocation_previews_mode", "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.CheckConstraint("ck_organization_allocation_previews_source", "funding_source = 'ORGANIZATION'");
                table.CheckConstraint("ck_organization_allocation_previews_instruction_state", "funding_instruction_state IN ('PENDING_VERIFICATION','VERIFIED')");
                table.CheckConstraint("ck_organization_allocation_previews_state", "state = 'PREVIEW_ONLY'");
                table.CheckConstraint("ck_organization_allocation_previews_hash", "payload_sha256 ~ '^[a-f0-9]{64}$'");
                table.ForeignKey("fk_organization_allocation_previews_organizations", x => x.organization_id,
                    principalSchema: "organization", principalTable: "organizations", principalColumn: "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("fk_organization_allocation_previews_funding_instructions", x => x.funding_instruction_id,
                    principalSchema: "organization", principalTable: "funding_instructions", principalColumn: "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("fk_organization_allocation_previews_programs", x => x.program_id,
                    principalSchema: "organization", principalTable: "programs", principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ux_organization_allocation_previews_creation_key",
            schema: "organization",
            table: "allocation_previews",
            column: "creation_key",
            unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_allocation_previews_funding_instruction_id",
            schema: "organization",
            table: "allocation_previews",
            column: "funding_instruction_id");
        migrationBuilder.CreateIndex(
            name: "ix_allocation_previews_organization_id",
            schema: "organization",
            table: "allocation_previews",
            column: "organization_id");
        migrationBuilder.CreateIndex(
            name: "ix_organization_allocation_previews_program_created",
            schema: "organization",
            table: "allocation_previews",
            columns: new[] { "program_id", "created_at_utc", "id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "allocation_previews", schema: "organization");
}
