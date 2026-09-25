using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260925210000_IdentityStep")]
public sealed class IdentityStep : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "natural_national_code",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(10)",
            maxLength: 10,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "legal_national_id",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(11)",
            maxLength: 11,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "legal_name",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(180)",
            maxLength: 180,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "legal_representative_name",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "legal_representative_phone",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(11)",
            maxLength: 11,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "identity_status",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_identity_status",
            schema: "seller",
            table: "registration_drafts",
            sql: "identity_status IS NULL OR identity_status IN ('VERIFIED', 'RECORDED')");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_identity_shape",
            schema: "seller",
            table: "registration_drafts",
            sql: "(completed_step < 3 AND identity_status IS NULL AND natural_national_code IS NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                 "(completed_step >= 3 AND applicant_type = 'NATURAL' AND identity_status = 'VERIFIED' AND natural_national_code IS NOT NULL AND legal_national_id IS NULL AND legal_name IS NULL AND legal_representative_name IS NULL AND legal_representative_phone IS NULL) OR " +
                 "(completed_step >= 3 AND applicant_type = 'LEGAL' AND identity_status = 'RECORDED' AND natural_national_code IS NULL AND legal_national_id IS NOT NULL AND legal_name IS NOT NULL AND legal_representative_name IS NOT NULL AND legal_representative_phone IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_identity_shape",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_identity_status",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "natural_national_code",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "legal_national_id",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "legal_name",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "legal_representative_name",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "legal_representative_phone",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "identity_status",
            schema: "seller",
            table: "registration_drafts");
    }
}
