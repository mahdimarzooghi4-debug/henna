using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260928170000_PublicSellerIdentity")]
public sealed class PublicSellerIdentity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "public_seller_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: false,
            defaultValueSql: "gen_random_uuid()");

        migrationBuilder.CreateIndex(
            name: "ux_registration_drafts_public_seller_id",
            schema: "seller",
            table: "registration_drafts",
            column: "public_seller_id",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ux_registration_drafts_public_seller_id",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "public_seller_id",
            schema: "seller",
            table: "registration_drafts");
    }
}
