using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260925150000_SubmitRegistration")]
public sealed class SubmitRegistration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddColumn<Guid>(
            name: "submission_key",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);
        migrationBuilder.AddColumn<int>(
            name: "submission_expected_revision",
            schema: "seller",
            table: "registration_drafts",
            type: "integer",
            nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "submitted_at_utc",
            schema: "seller",
            table: "registration_drafts",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts",
            sql: "status IN ('DRAFT', 'SUBMITTED')");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql: "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL) OR (status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "submission_key", schema: "seller", table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "submission_expected_revision", schema: "seller", table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "submitted_at_utc", schema: "seller", table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts",
            sql: "status = 'DRAFT'");
    }
}
