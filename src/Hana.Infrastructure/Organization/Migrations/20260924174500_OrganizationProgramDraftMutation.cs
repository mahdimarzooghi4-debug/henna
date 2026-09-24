using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924174500_OrganizationProgramDraftMutation")]
public sealed class OrganizationProgramDraftMutation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "revision",
            schema: "organization",
            table: "programs",
            type: "integer",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.AddColumn<Guid>(
            name: "creation_key",
            schema: "organization",
            table: "programs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "creation_fingerprint",
            schema: "organization",
            table: "programs",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "created_by_account_id",
            schema: "organization",
            table: "programs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "updated_by_account_id",
            schema: "organization",
            table: "programs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_programs_revision",
            schema: "organization",
            table: "programs",
            sql: "revision >= 1");

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_programs_creation_key",
            schema: "organization",
            table: "programs",
            sql: "creation_key IS NULL OR creation_key <> '00000000-0000-0000-0000-000000000000'::uuid");

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_programs_creation_fingerprint",
            schema: "organization",
            table: "programs",
            sql: "(creation_key IS NULL AND creation_fingerprint IS NULL) OR (creation_key IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}
            name: "ix_organization_programs_org_creation_key",
            schema: "organization",
            table: "programs",
            columns: new[] { "organization_id", "creation_key" },
            unique: true,
            filter: "creation_key IS NOT NULL");

        // Audit references are nullable for pre-existing rows created before
        // draft mutation was introduced. New API writes always populate them.
        migrationBuilder.AddForeignKey(
            name: "fk_organization_programs_created_by_identity_accounts",
            schema: "organization",
            table: "programs",
            column: "created_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "fk_organization_programs_updated_by_identity_accounts",
            schema: "organization",
            table: "programs",
            column: "updated_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_organization_programs_created_by_identity_accounts",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropForeignKey(
            name: "fk_organization_programs_updated_by_identity_accounts",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropIndex(
            name: "ix_organization_programs_org_creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_revision",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_creation_fingerprint",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "revision",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "creation_fingerprint",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "created_by_account_id",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "updated_by_account_id",
            schema: "organization",
            table: "programs");
    }
}
)");

        migrationBuilder.CreateIndex(
            name: "ix_organization_programs_org_creation_key",
            schema: "organization",
            table: "programs",
            columns: new[] { "organization_id", "creation_key" },
            unique: true,
            filter: "creation_key IS NOT NULL");

        // Audit references are nullable for pre-existing rows created before
        // draft mutation was introduced. New API writes always populate them.
        migrationBuilder.AddForeignKey(
            name: "fk_organization_programs_created_by_identity_accounts",
            schema: "organization",
            table: "programs",
            column: "created_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "fk_organization_programs_updated_by_identity_accounts",
            schema: "organization",
            table: "programs",
            column: "updated_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_organization_programs_created_by_identity_accounts",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropForeignKey(
            name: "fk_organization_programs_updated_by_identity_accounts",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropIndex(
            name: "ix_organization_programs_org_creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_revision",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_programs_creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "revision",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "creation_key",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "created_by_account_id",
            schema: "organization",
            table: "programs");

        migrationBuilder.DropColumn(
            name: "updated_by_account_id",
            schema: "organization",
            table: "programs");
    }
}
