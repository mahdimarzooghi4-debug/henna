using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924183000_OrganizationProgramRegistration")]
public sealed class OrganizationProgramRegistration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "registration_key",
            schema: "organization",
            table: "programs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "registration_expected_revision",
            schema: "organization",
            table: "programs",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "registered_by_account_id",
            schema: "organization",
            table: "programs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "registered_at_utc",
            schema: "organization",
            table: "programs",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_programs_registration_key",
            schema: "organization",
            table: "programs",
            sql: "registration_key IS NULL OR registration_key <> '00000000-0000-0000-0000-000000000000'::uuid");

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_programs_registration_pair",
            schema: "organization",
            table: "programs",
            sql: "(registration_key IS NULL AND registration_expected_revision IS NULL) OR (registration_key IS NOT NULL AND registration_expected_revision >= 1)");

        // Nullable only for rows that may already be REGISTERED before this
        // transition contract existed. New register actions always set actor/time.
        migrationBuilder.AddForeignKey(
            name: "fk_organization_programs_registered_by_identity_accounts",
            schema: "organization",
            table: "programs",
            column: "registered_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_organization_programs_registered_by_identity_accounts",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_registration_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_registration_pair",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "registration_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "registration_expected_revision",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "registered_by_account_id",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "registered_at_utc",
            schema: "organization",
            table: "programs");
    }
}
