using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924170000_OrganizationProgramsReadModel")]
public sealed class OrganizationProgramsReadModel : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "programs", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)",
                    maxLength: 200, nullable: false),
                kind = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                allocation_method = table.Column<string>(
                    type: "character varying(120)", maxLength: 120, nullable: false),
                beneficiary_source = table.Column<string>(
                    type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(2000)",
                    maxLength: 2000, nullable: true),
                status = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false, defaultValue: "DRAFT"),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_organization_programs", x => x.id);
                table.CheckConstraint("ck_organization_programs_name",
                    "length(btrim(name)) > 0");
                table.CheckConstraint("ck_organization_programs_kind",
                    "length(btrim(kind)) > 0");
                table.CheckConstraint("ck_organization_programs_allocation_method",
                    "length(btrim(allocation_method)) > 0");
                table.CheckConstraint("ck_organization_programs_beneficiary_source",
                    "length(btrim(beneficiary_source)) > 0");
                table.CheckConstraint("ck_organization_programs_status",
                    "status IN ('DRAFT', 'REGISTERED', 'ACTIVE', 'PAUSED', 'ENDED')");
                table.ForeignKey("fk_organization_programs_organizations",
                    x => x.organization_id,
                    principalSchema: "organization", principalTable: "organizations",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_organization_programs_org_status_created",
            schema: "organization", table: "programs",
            columns: new[] { "organization_id", "status", "created_at_utc", "id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "programs", schema: "organization");
    }
}
