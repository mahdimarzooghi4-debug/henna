using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260921000000_DraftRevision")]
public sealed class DraftRevision : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Existing real drafts remain editable at revision 1.
        migrationBuilder.AddColumn<int>(
            name: "revision",
            schema: "seller",
            table: "registration_drafts",
            type: "integer",
            nullable: false,
            defaultValue: 1);
        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_drafts_revision",
            schema: "seller",
            table: "registration_drafts",
            sql: "revision >= 1");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_drafts_revision",
            schema: "seller",
            table: "registration_drafts");
        migrationBuilder.DropColumn(
            name: "revision", schema: "seller", table: "registration_drafts");
    }
}
