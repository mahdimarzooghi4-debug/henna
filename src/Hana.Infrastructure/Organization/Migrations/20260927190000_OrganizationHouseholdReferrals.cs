using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260927190000_OrganizationHouseholdReferrals")]
public sealed class OrganizationHouseholdReferrals : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "household_referrals", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                external_reference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                province_id = table.Column<Guid>(type: "uuid", nullable: false),
                city_id = table.Column<Guid>(type: "uuid", nullable: true),
                settlement_type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                revision = table.Column<int>(type: "integer", nullable: false),
                submitted_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                submitted_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                creation_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_household_referrals", x => x.id);
                table.CheckConstraint("ck_organization_household_referrals_reference", "char_length(btrim(external_reference)) BETWEEN 1 AND 120");
                table.CheckConstraint("ck_organization_household_referrals_settlement", "settlement_type IN ('URBAN','RURAL')");
                table.CheckConstraint("ck_organization_household_referrals_revision", "revision = 1");
                table.ForeignKey("fk_organization_household_referrals_programs", x => x.program_id,
                    principalSchema: "organization", principalTable: "programs", principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(name: "ux_organization_household_referrals_external_reference", schema: "organization", table: "household_referrals", columns: new[] { "organization_id", "program_id", "external_reference" }, unique: true);
        migrationBuilder.CreateIndex(name: "ix_organization_household_referrals_program", schema: "organization", table: "household_referrals", column: "program_id");
        migrationBuilder.CreateIndex(name: "ux_organization_household_referrals_creation_key", schema: "organization", table: "household_referrals", column: "creation_key", unique: true);

        migrationBuilder.CreateTable(
            name: "household_members", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                household_referral_id = table.Column<Guid>(type: "uuid", nullable: false),
                member_number = table.Column<int>(type: "integer", nullable: false),
                gender_category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                life_stage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                education_level = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                health_need = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_household_members", x => x.id);
                table.CheckConstraint("ck_organization_household_members_number", "member_number BETWEEN 1 AND 20");
                table.CheckConstraint("ck_organization_household_members_gender", "gender_category IN ('FEMALE','MALE','NOT_REPORTED')");
                table.CheckConstraint("ck_organization_household_members_life_stage", "life_stage IN ('INFANT','PRESCHOOL','SCHOOL_AGE','ADULT','OLDER_ADULT')");
                table.CheckConstraint("ck_organization_household_members_education", "education_level IN ('NO_FORMAL_EDUCATION','PRIMARY','SECONDARY','DIPLOMA','HIGHER_EDUCATION','NOT_REPORTED')");
                table.CheckConstraint("ck_organization_household_members_health", "health_need IN ('NO_KNOWN_CHRONIC_NEED','CHRONIC_NEED','NOT_REPORTED')");
                table.ForeignKey("fk_organization_household_members_referrals", x => x.household_referral_id,
                    principalSchema: "organization", principalTable: "household_referrals", principalColumn: "id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "ux_organization_household_members_number", schema: "organization", table: "household_members", columns: new[] { "household_referral_id", "member_number" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "household_members", schema: "organization");
        migrationBuilder.DropTable(name: "household_referrals", schema: "organization");
    }
}
