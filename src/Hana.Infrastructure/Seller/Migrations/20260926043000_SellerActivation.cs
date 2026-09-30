using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926043000_SellerActivation")]
public sealed class SellerActivation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "activated_at_utc",
            schema: "seller",
            table: "registration_drafts",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "activated_by_account_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activation",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(activated_at_utc IS NULL AND activated_by_account_id IS NULL) OR " +
                "(status = 'SUBMITTED' AND review_status = 'APPROVED' AND activated_at_utc IS NOT NULL AND activated_by_account_id IS NOT NULL)");

        migrationBuilder.CreateTable(
            name: "seller_activations",
            schema: "seller",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                application_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                activated_by_account_id = table.Column<Guid>(
                    type: "uuid", nullable: false),
                activation_key = table.Column<Guid>(
                    type: "uuid", nullable: false),
                expected_revision = table.Column<int>(
                    type: "integer", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_seller_activations", x => x.id);
                table.CheckConstraint("ck_seller_activations_revision",
                    "expected_revision >= 1");
                table.ForeignKey(
                    name: "fk_seller_activations_registration_drafts",
                    column: x => x.application_account_id,
                    principalSchema: "seller",
                    principalTable: "registration_drafts",
                    principalColumn: "account_id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ux_seller_activations_activation_key",
            schema: "seller",
            table: "seller_activations",
            column: "activation_key",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ux_seller_activations_application",
            schema: "seller",
            table: "seller_activations",
            column: "application_account_id",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "seller_activations",
            schema: "seller");

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activation",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "activated_at_utc",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "activated_by_account_id",
            schema: "seller",
            table: "registration_drafts");
    }
}
