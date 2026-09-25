using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926013000_ReviewAccuracyConfirmation")]
public sealed class ReviewAccuracyConfirmation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "accuracy_confirmed_at_utc",
            schema: "seller",
            table: "registration_drafts",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL) OR " +
                "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "accuracy_confirmed_at_utc",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL) OR " +
                "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL)");
    }
}
