using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926031000_AdminReviewWorkflow")]
public sealed class AdminReviewWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "review_status",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);
        migrationBuilder.AddColumn<string>(
            name: "review_reason",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);
        migrationBuilder.AddColumn<Guid>(
            name: "reviewed_by_account_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "reviewed_at_utc",
            schema: "seller",
            table: "registration_drafts",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE seller.registration_drafts
            SET review_status = 'UNDER_REVIEW'
            WHERE status = 'SUBMITTED' AND review_status IS NULL;
            """);

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

        migrationBuilder.CreateTable(
            name: "application_reviews",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                application_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                reviewer_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                decision_key = table.Column<Guid>(type: "uuid", nullable: false),
                expected_revision = table.Column<int>(type: "integer", nullable: false),
                decision = table.Column<string>(type: "character varying(32)",
                    maxLength: 32, nullable: false),
                reason = table.Column<string>(type: "character varying(500)",
                    maxLength: 500, nullable: true),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_application_reviews", x => x.id);
                table.ForeignKey(
                    name: "fk_application_reviews_registration_drafts",
                    column: x => x.application_account_id,
                    principalSchema: "seller",
                    principalTable: "registration_drafts",
                    principalColumn: "account_id",
                    onDelete: ReferentialAction.Cascade);
                table.CheckConstraint("ck_application_reviews_decision",
                    "decision IN ('NEEDS_INFORMATION','APPROVED','REJECTED')");
                table.CheckConstraint("ck_application_reviews_revision",
                    "expected_revision >= 1");
                table.CheckConstraint("ck_application_reviews_reason",
                    "(decision = 'APPROVED' AND (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500)) OR " +
                    "(decision IN ('NEEDS_INFORMATION','REJECTED') AND char_length(btrim(reason)) BETWEEN 1 AND 500)");
            });

        migrationBuilder.CreateIndex(
            name: "ux_application_reviews_decision_key",
            schema: "seller",
            table: "application_reviews",
            column: "decision_key",
            unique: true);
        migrationBuilder.CreateIndex(
            name: "ix_application_reviews_application_created",
            schema: "seller",
            table: "application_reviews",
            columns: new[] { "application_account_id", "created_at_utc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "application_reviews",
            schema: "seller");
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_review_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "review_status",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "review_reason",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "reviewed_by_account_id",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "reviewed_at_utc",
            schema: "seller",
            table: "registration_drafts");
    }
}
