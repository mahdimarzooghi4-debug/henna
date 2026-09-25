using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926040000_NeedsInformationRework")]
public sealed class NeedsInformationRework : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_review_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submitted_completed",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts",
            sql: "status IN ('DRAFT', 'SUBMITTED', 'REWORK')");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL AND tracking_code IS NULL) OR " +
                "(status IN ('SUBMITTED','REWORK') AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL AND tracking_code IS NOT NULL AND char_length(tracking_code) BETWEEN 8 AND 24)");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submitted_completed",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status <> 'SUBMITTED' OR completed_step = 6 OR (completed_step = 1 AND applicant_type IS NULL)) AND " +
                "(status <> 'REWORK' OR completed_step = 6)");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_review_status",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND review_status IS NULL AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                "(status = 'SUBMITTED' AND review_status IN ('UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED') AND " +
                "((review_status = 'UNDER_REVIEW' AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                "(review_status <> 'UNDER_REVIEW' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND " +
                "(review_status = 'APPROVED' OR char_length(btrim(review_reason)) BETWEEN 1 AND 500)))) OR " +
                "(status = 'REWORK' AND review_status = 'NEEDS_INFORMATION' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND char_length(btrim(review_reason)) BETWEEN 1 AND 500)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE seller.registration_drafts
            SET status = 'SUBMITTED'
            WHERE status = 'REWORK';
            """);

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_review_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_submitted_completed",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submitted_completed",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "status <> 'SUBMITTED' OR completed_step = 6 OR (completed_step = 1 AND applicant_type IS NULL)");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_status",
            schema: "seller",
            table: "registration_drafts",
            sql: "status IN ('DRAFT', 'SUBMITTED')");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_submission_metadata",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND submission_key IS NULL AND submission_expected_revision IS NULL AND submitted_at_utc IS NULL AND accuracy_confirmed_at_utc IS NULL AND tracking_code IS NULL) OR " +
                "(status = 'SUBMITTED' AND submission_key IS NOT NULL AND submission_expected_revision >= 1 AND submitted_at_utc IS NOT NULL AND accuracy_confirmed_at_utc IS NOT NULL AND tracking_code IS NOT NULL AND char_length(tracking_code) BETWEEN 8 AND 24)");
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_review_status",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(status = 'DRAFT' AND review_status IS NULL AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                "(status = 'SUBMITTED' AND review_status IN ('UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED') AND " +
                "((review_status = 'UNDER_REVIEW' AND review_reason IS NULL AND reviewed_by_account_id IS NULL AND reviewed_at_utc IS NULL) OR " +
                "(review_status <> 'UNDER_REVIEW' AND reviewed_by_account_id IS NOT NULL AND reviewed_at_utc IS NOT NULL AND " +
                "(review_status = 'APPROVED' OR char_length(btrim(review_reason)) BETWEEN 1 AND 500))))");
    }
}
