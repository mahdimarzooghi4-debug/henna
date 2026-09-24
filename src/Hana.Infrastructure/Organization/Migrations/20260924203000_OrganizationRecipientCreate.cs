using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924203000_OrganizationRecipientCreate")]
public sealed class OrganizationRecipientCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "reference_fingerprint",
            schema: "organization",
            table: "recipients",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "creation_key",
            schema: "organization",
            table: "recipients",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "creation_fingerprint",
            schema: "organization",
            table: "recipients",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "created_by_account_id",
            schema: "organization",
            table: "recipients",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_recipients_reference_fingerprint",
            schema: "organization",
            table: "recipients",
            sql: "reference_fingerprint IS NULL OR reference_fingerprint ~ '^[0-9a-f]{64}$'");

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_recipients_creation_key",
            schema: "organization",
            table: "recipients",
            sql: "creation_key IS NULL OR creation_key <> '00000000-0000-0000-0000-000000000000'::uuid");

        migrationBuilder.AddCheckConstraint(
            name: "ck_organization_recipients_creation_fingerprint",
            schema: "organization",
            table: "recipients",
            sql: "(creation_key IS NULL AND creation_fingerprint IS NULL) OR (creation_key IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}$')");

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_org_program_reference",
            schema: "organization",
            table: "recipients",
            columns: new[]
            {
                "organization_id", "program_id", "reference_fingerprint"
            },
            unique: true,
            filter: "reference_fingerprint IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "ix_organization_recipients_org_creation_key",
            schema: "organization",
            table: "recipients",
            columns: new[] { "organization_id", "creation_key" },
            unique: true,
            filter: "creation_key IS NOT NULL");

        // Historical recipients predate this mutation contract, so the actor is
        // nullable. New manual creates always populate it.
        migrationBuilder.AddForeignKey(
            name: "fk_organization_recipients_created_by_identity_accounts",
            schema: "organization",
            table: "recipients",
            column: "created_by_account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_organization_recipients_created_by_identity_accounts",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropIndex(
            name: "ix_organization_recipients_org_program_reference",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropIndex(
            name: "ix_organization_recipients_org_creation_key",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_recipients_reference_fingerprint",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_recipients_creation_key",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropCheckConstraint(
            name: "ck_organization_recipients_creation_fingerprint",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "reference_fingerprint",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "creation_key",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "creation_fingerprint",
            schema: "organization",
            table: "recipients");

        migrationBuilder.DropColumn(
            name: "created_by_account_id",
            schema: "organization",
            table: "recipients");
    }
}
