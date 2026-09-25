using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926035500_ApplicationAmendments")]
public sealed class ApplicationAmendments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "application_amendments",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                application_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                base_revision = table.Column<int>(type: "integer", nullable: false),
                status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                reviewer_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                response_text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                reference_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                resubmitted_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_application_amendments", x => x.id);
                table.ForeignKey(
                    name: "fk_application_amendments_registration_drafts",
                    column: x => x.application_account_id,
                    principalSchema: "seller",
                    principalTable: "registration_drafts",
                    principalColumn: "account_id",
                    onDelete: ReferentialAction.Cascade);
                table.CheckConstraint("ck_application_amendments_status",
                    "status IN ('OPEN','RESUBMITTED')");
                table.CheckConstraint("ck_application_amendments_revision",
                    "base_revision >= 1");
                table.CheckConstraint("ck_application_amendments_text",
                    "char_length(btrim(reviewer_reason)) BETWEEN 1 AND 500 AND char_length(btrim(response_text)) BETWEEN 1 AND 2000");
                table.CheckConstraint("ck_application_amendments_resubmitted",
                    "(status = 'OPEN' AND resubmitted_at_utc IS NULL) OR (status = 'RESUBMITTED' AND resubmitted_at_utc IS NOT NULL)");
            });

        migrationBuilder.CreateIndex(
            name: "ux_application_amendments_open_application",
            schema: "seller",
            table: "application_amendments",
            column: "application_account_id",
            unique: true,
            filter: "status = 'OPEN'");

        migrationBuilder.CreateIndex(
            name: "ix_application_amendments_application_status",
            schema: "seller",
            table: "application_amendments",
            columns: new[] { "application_account_id", "status" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "application_amendments",
            schema: "seller");
    }
}
