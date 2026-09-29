using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260929170000_OrganizationHouseholdAssessmentInputs")]
public sealed class OrganizationHouseholdAssessmentInputs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("health_burden_level", "household_referrals", "character varying(64)", schema: "organization", maxLength: 64, nullable: true);
        migrationBuilder.AddColumn<string>("economic_hardship_level", "household_referrals", "character varying(64)", schema: "organization", maxLength: 64, nullable: true);
        migrationBuilder.AddColumn<string>("care_support_level", "household_referrals", "character varying(80)", schema: "organization", maxLength: 80, nullable: true);
        migrationBuilder.AddColumn<string>("education_attainment", "household_referrals", "character varying(40)", schema: "organization", maxLength: 40, nullable: true);
        migrationBuilder.AddColumn<bool>("needs_practical_support", "household_members", "boolean", schema: "organization", nullable: true);

        migrationBuilder.AddCheckConstraint("ck_organization_household_referrals_health_burden", "household_referrals", "health_burden_level IS NULL OR health_burden_level IN ('NO_ONGOING_TREATMENT','ONE_MANAGEABLE_ONGOING_CASE','HIGH_COST_OR_LIMITING_OR_MULTIPLE_MANAGEABLE_CASES','SEVERE_ONGOING_CARE_OR_MULTIPLE_HIGH_BURDEN_CASES')", schema: "organization");
        migrationBuilder.AddCheckConstraint("ck_organization_household_referrals_economic_hardship", "household_referrals", "economic_hardship_level IS NULL OR economic_hardship_level IN ('ESSENTIAL_NEEDS_GENERALLY_MET','OCCASIONAL_SHORTFALL_IN_ONE_ESSENTIAL_NEED','RECURRENT_SHORTFALL_OR_ESSENTIAL_DEBT','MULTIPLE_ESSENTIAL_NEEDS_UNMET_OR_SEVERE_INSTABILITY')", schema: "organization");
        migrationBuilder.AddCheckConstraint("ck_organization_household_referrals_care_support", "household_referrals", "care_support_level IS NULL OR care_support_level IN ('EFFECTIVE_ADULT_OR_PRACTICAL_SUPPORT_AVAILABLE','ONE_RESPONSIBLE_ADULT_WITHOUT_DEPENDENTS','LONE_CAREGIVER_WITH_ONE_DEPENDENT_OR_LIMITED_SUPPORT','NO_PRACTICAL_SUPPORT_WITH_MULTIPLE_DEPENDENTS_OR_HIGH_CARE_BURDEN')", schema: "organization");
        migrationBuilder.AddCheckConstraint("ck_organization_household_referrals_education_attainment", "household_referrals", "education_attainment IS NULL OR education_attainment IN ('BACHELOR_OR_HIGHER','DIPLOMA_OR_ASSOCIATE','BELOW_DIPLOMA_WITH_FORMAL_EDUCATION','NO_LITERACY_OR_FORMAL_EDUCATION')", schema: "organization");
        migrationBuilder.AddCheckConstraint("ck_organization_household_members_practical_support", "household_members", "needs_practical_support IS NULL OR life_stage = 'OLDER_ADULT' OR needs_practical_support = FALSE", schema: "organization");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint("ck_organization_household_members_practical_support", "household_members", schema: "organization");
        migrationBuilder.DropCheckConstraint("ck_organization_household_referrals_education_attainment", "household_referrals", schema: "organization");
        migrationBuilder.DropCheckConstraint("ck_organization_household_referrals_care_support", "household_referrals", schema: "organization");
        migrationBuilder.DropCheckConstraint("ck_organization_household_referrals_economic_hardship", "household_referrals", schema: "organization");
        migrationBuilder.DropCheckConstraint("ck_organization_household_referrals_health_burden", "household_referrals", schema: "organization");
        migrationBuilder.DropColumn("needs_practical_support", "household_members", schema: "organization");
        migrationBuilder.DropColumn("education_attainment", "household_referrals", schema: "organization");
        migrationBuilder.DropColumn("care_support_level", "household_referrals", schema: "organization");
        migrationBuilder.DropColumn("economic_hardship_level", "household_referrals", schema: "organization");
        migrationBuilder.DropColumn("health_burden_level", "household_referrals", schema: "organization");
    }
}
