using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260929160000_OrganizationHouseholdHousingTenure")]
public sealed class OrganizationHouseholdHousingTenure : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "housing_tenure",
            schema: "organization",
            table: "household_referrals",
            type: "character varying(8)",
            maxLength: 8,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_household_referrals_housing_tenure",
            schema: "organization",
            table: "household_referrals",
            sql: "housing_tenure IS NULL OR housing_tenure IN ('OWNER','TENANT')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_household_referrals_housing_tenure",
            schema: "organization",
            table: "household_referrals");

        migrationBuilder.DropColumn(
            name: "housing_tenure",
            schema: "organization",
            table: "household_referrals");
    }
}
