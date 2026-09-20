using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260920235000_InitialSellerDraft")]
public sealed class InitialSellerDraft : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "seller");
        migrationBuilder.CreateTable(
            name: "registration_drafts", schema: "seller",
            columns: table => new
            {
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                store_name = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                owner_name = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                phone = table.Column<string>(type: "character varying(11)",
                    maxLength: 11, nullable: false),
                city = table.Column<string>(type: "character varying(120)",
                    maxLength: 120, nullable: false),
                address = table.Column<string>(type: "character varying(500)",
                    maxLength: 500, nullable: false),
                postal_code = table.Column<string>(type: "character varying(10)",
                    maxLength: 10, nullable: false),
                status = table.Column<string>(type: "character varying(16)",
                    maxLength: 16, nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_registration_drafts", x => x.account_id);
                table.CheckConstraint("ck_registration_drafts_status",
                    "status = 'DRAFT'");
                table.ForeignKey("fk_registration_drafts_accounts", x => x.account_id,
                    principalSchema: "identity", principalTable: "accounts",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "registration_drafts", schema: "seller");
    }
}
