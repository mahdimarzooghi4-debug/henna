using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260925190000_ApplicantTypeProgress")]
public sealed class ApplicantTypeProgress : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "applicant_type",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "completed_step",
            schema: "seller",
            table: "registration_drafts",
            type: "integer",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_completed_step",
            schema: "seller",
            table: "registration_drafts",
            sql: "completed_step BETWEEN 1 AND 6");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_applicant_type",
            schema: "seller",
            table: "registration_drafts",
            sql: "applicant_type IS NULL OR applicant_type IN ('NATURAL', 'LEGAL')");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_applicant_type_step",
            schema: "seller",
            table: "registration_drafts",
            sql: "(completed_step < 2 AND applicant_type IS NULL) OR (completed_step >= 2 AND applicant_type IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_applicant_type_step",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_applicant_type",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_completed_step",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "applicant_type",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "completed_step",
            schema: "seller",
            table: "registration_drafts");
    }
}
