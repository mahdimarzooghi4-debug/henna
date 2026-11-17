using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260927170000_OrganizationProgramDrafts")]
public sealed class OrganizationProgramDrafts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "programs", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                allocation_mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                description = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: false),
                state = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                revision = table.Column<int>(type: "integer", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                created_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                creation_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_programs", x => x.id);
                table.CheckConstraint("ck_organization_programs_name", "char_length(btrim(name)) BETWEEN 1 AND 120");
                table.CheckConstraint("ck_organization_programs_allocation_mode", "allocation_mode IN ('HENNA_NEEDS_BASED','ORGANIZATION_DEFINED')");
                table.CheckConstraint("ck_organization_programs_description", "char_length(description) <= 1200");
                table.CheckConstraint("ck_organization_programs_state", "state = 'DRAFT' AND revision = 1");
                table.ForeignKey("fk_organization_programs_organizations", x => x.organization_id,
                    principalSchema: "organization", principalTable: "organizations",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(name: "ix_organization_programs_org_created_at",
            schema: "organization", table: "programs", columns: new[] { "organization_id", "created_at_utc" });
        migrationBuilder.CreateIndex(name: "ux_organization_programs_creation_key",
            schema: "organization", table: "programs", column: "creation_key", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "programs", schema: "organization");
}
