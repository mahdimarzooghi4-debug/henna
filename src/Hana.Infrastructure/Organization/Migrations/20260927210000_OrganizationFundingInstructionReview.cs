using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260927210000_OrganizationFundingInstructionReview")]
public sealed class OrganizationFundingInstructionReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_funding_instructions_state",
            schema: "organization",
            table: "funding_instructions");
        migrationBuilder.AddColumn<Guid>(
            name: "reviewed_by_account_id", schema: "organization", table: "funding_instructions",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "reviewed_at_utc", schema: "organization", table: "funding_instructions",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "review_reason", schema: "organization", table: "funding_instructions",
            type: "character varying(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_funding_instructions_state",
            schema: "organization", table: "funding_instructions",
            sql: "state IN ('PENDING_VERIFICATION','VERIFIED','REJECTED') AND program_revision = 1 AND revision >= 1");
        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_funding_instructions_review",
            schema: "organization", table: "funding_instructions",
            sql: "(state = 'PENDING_VERIFICATION' AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL AND review_reason IS NULL) OR (state = 'VERIFIED' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL) OR (state = 'REJECTED' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND review_reason IS NOT NULL AND char_length(btrim(review_reason)) BETWEEN 1 AND 1000)");

        migrationBuilder.CreateTable(
            name: "funding_instruction_events", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                funding_instruction_id = table.Column<Guid>(type: "uuid", nullable: false),
                revision = table.Column<int>(type: "integer", nullable: false),
                event_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                source_instruction_reference = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                actor_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                idempotency_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_funding_instruction_events", x => x.id);
                table.CheckConstraint("ck_organization_funding_instruction_events_revision", "revision >= 2");
                table.CheckConstraint("ck_organization_funding_instruction_events_type", "event_type IN ('VERIFIED','REJECTED','RESUBMITTED')");
                table.CheckConstraint("ck_organization_funding_instruction_events_reason", "event_type <> 'REJECTED' OR (reason IS NOT NULL AND char_length(btrim(reason)) BETWEEN 1 AND 1000)");
                table.CheckConstraint("ck_organization_funding_instruction_events_reference", "char_length(btrim(source_instruction_reference)) BETWEEN 1 AND 160");
                table.ForeignKey("fk_organization_funding_instruction_events_instructions", x => x.funding_instruction_id,
                    principalSchema: "organization", principalTable: "funding_instructions", principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(
            name: "ux_organization_funding_instruction_events_revision",
            schema: "organization", table: "funding_instruction_events",
            columns: new[] { "funding_instruction_id", "revision" }, unique: true);
        migrationBuilder.CreateIndex(
            name: "ux_organization_funding_instruction_events_idempotency_key",
            schema: "organization", table: "funding_instruction_events",
            column: "idempotency_key", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "funding_instruction_events", schema: "organization");
        migrationBuilder.DropCheckConstraint(name: "ck_organization_funding_instructions_review", schema: "organization", table: "funding_instructions");
        migrationBuilder.DropCheckConstraint(name: "ck_organization_funding_instructions_state", schema: "organization", table: "funding_instructions");
        migrationBuilder.DropColumn(name: "reviewed_by_account_id", schema: "organization", table: "funding_instructions");
        migrationBuilder.DropColumn(name: "reviewed_at_utc", schema: "organization", table: "funding_instructions");
        migrationBuilder.DropColumn(name: "review_reason", schema: "organization", table: "funding_instructions");
        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_funding_instructions_state",
            schema: "organization", table: "funding_instructions",
            sql: "state = 'PENDING_VERIFICATION' AND program_revision = 1 AND revision = 1");
    }
}
