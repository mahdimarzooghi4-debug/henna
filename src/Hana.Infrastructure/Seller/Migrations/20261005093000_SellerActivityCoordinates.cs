using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20261005093000_SellerActivityCoordinates")]
public sealed class SellerActivityCoordinates : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "activity_latitude",
            schema: "seller",
            table: "registration_drafts",
            type: "numeric(9,6)",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "activity_longitude",
            schema: "seller",
            table: "registration_drafts",
            type: "numeric(9,6)",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activity_coordinates",
            schema: "seller",
            table: "registration_drafts",
            sql: "(activity_latitude IS NULL AND activity_longitude IS NULL) OR " +
                "(activity_latitude >= -90 AND activity_latitude <= 90 AND " +
                "activity_longitude >= -180 AND activity_longitude <= 180)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activity_coordinates",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "activity_latitude",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropColumn(
            name: "activity_longitude",
            schema: "seller",
            table: "registration_drafts");
    }
}
