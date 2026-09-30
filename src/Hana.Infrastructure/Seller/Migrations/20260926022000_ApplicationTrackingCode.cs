using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926022000_ApplicationTrackingCode")]
public sealed class ApplicationTrackingCode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddColumn<string>(
            name: "tracking_code",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(24)",
            maxLength: 24,
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE seller.registration_drafts
            SET tracking_code =
              'HNA-' || upper(substr(md5(submission_key::text), 1, 16))
            WHERE status = 'SUBMITTED'
              AND tracking_code IS NULL
              AND submission_key IS NOT NULL;
            """);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL AND tracking_code IS NULL) OR " +
                "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL AND tracking_code IS NOT NULL AND char_length(tracking_code) BETWEEN 8 AND 24)");

        migrationBuilder.CreateIndex(
            name: "ux_registration_drafts_tracking_code",
            schema: "seller",
            table: "registration_drafts",
            column: "tracking_code",
            unique: true,
            filter: "tracking_code IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ux_registration_drafts_tracking_code",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "tracking_code",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL) OR " +
                "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL)");
    }
}
