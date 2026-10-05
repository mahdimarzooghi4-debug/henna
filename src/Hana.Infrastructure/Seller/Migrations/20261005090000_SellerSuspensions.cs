using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20261005090000_SellerSuspensions")]
public sealed class SellerSuspensions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "seller_suspensions",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                application_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                suspended_by_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                suspension_key = table.Column<Guid>(
                    type: "uuid", nullable: false),
                expected_revision = table.Column<int>(
                    type: "integer", nullable: false),
                reason = table.Column<string>(
                    type: "character varying(500)", maxLength: 500,
                    nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                restored_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true),
                restored_by_account_id = table.Column<Guid>(
                    type: "uuid", nullable: true),
                restore_key = table.Column<Guid>(
                    type: "uuid", nullable: true),
                restore_expected_revision = table.Column<int>(
                    type: "integer", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_seller_suspensions", x => x.id);
                table.CheckConstraint("ck_seller_suspensions_reason",
                    "char_length(btrim(reason)) BETWEEN 1 AND 500");
                table.CheckConstraint("ck_seller_suspensions_restore",
                    "(restored_at_utc IS NULL AND restored_by_account_id IS NULL AND restore_key IS NULL AND restore_expected_revision IS NULL) OR " +
                    "(restored_at_utc IS NOT NULL AND restored_by_account_id IS NOT NULL AND restore_key IS NOT NULL AND restore_expected_revision >= 1)");
                table.CheckConstraint("ck_seller_suspensions_revision",
                    "expected_revision >= 1");
                table.ForeignKey(
                    name: "fk_seller_suspensions_registration_drafts",
                    column: x => x.application_account_id,
                    principalSchema: "seller",
                    principalTable: "registration_drafts",
                    principalColumn: "account_id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_seller_suspensions_application_created",
            schema: "seller",
            table: "seller_suspensions",
            columns: new[] { "application_account_id", "created_at_utc" });

        migrationBuilder.CreateIndex(
            name: "ux_seller_suspensions_open_application",
            schema: "seller",
            table: "seller_suspensions",
            column: "application_account_id",
            unique: true,
            filter: "restored_at_utc IS NULL");

        migrationBuilder.CreateIndex(
            name: "ux_seller_suspensions_restore_key",
            schema: "seller",
            table: "seller_suspensions",
            column: "restore_key",
            unique: true,
            filter: "restore_key IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "ux_seller_suspensions_suspension_key",
            schema: "seller",
            table: "seller_suspensions",
            column: "suspension_key",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "seller_suspensions",
            schema: "seller");
    }
}
