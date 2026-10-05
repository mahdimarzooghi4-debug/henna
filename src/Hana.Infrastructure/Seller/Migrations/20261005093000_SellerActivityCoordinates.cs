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

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activity_shape",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activity_shape",
            schema: "seller",
            table: "registration_drafts",
            sql: "(completed_step < 5 AND activity_province_id IS NULL AND " +
                "activity_city_id IS NULL AND activity_address IS NULL AND " +
                "activity_latitude IS NULL AND activity_longitude IS NULL AND " +
                "activity_hours IS NULL AND seller_delivery IS NULL AND " +
                "pickup IS NULL AND service_area IS NULL) OR " +
                "(completed_step >= 5 AND activity_province_id IS NOT NULL AND " +
                "activity_city_id IS NOT NULL AND " +
                "char_length(btrim(activity_address)) BETWEEN 1 AND 500 AND " +
                "char_length(btrim(activity_hours)) BETWEEN 1 AND 180 AND " +
                "seller_delivery IS NOT NULL AND pickup IS NOT NULL AND " +
                "(seller_delivery OR pickup) AND " +
                "char_length(btrim(service_area)) BETWEEN 1 AND 240)");

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activity_coordinates",
            schema: "seller",
            table: "registration_drafts",
            sql: "(activity_latitude IS NULL AND activity_longitude IS NULL) OR " +
                "(activity_latitude IS NOT NULL AND activity_longitude IS NOT NULL AND " +
                "activity_latitude >= -90 AND activity_latitude <= 90 AND " +
                "activity_longitude >= -180 AND activity_longitude <= 180)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activity_coordinates",
            schema: "seller",
            table: "registration_drafts");

        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activity_shape",
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

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activity_shape",
            schema: "seller",
            table: "registration_drafts",
            sql: "(completed_step < 5 AND activity_province_id IS NULL AND " +
                "activity_city_id IS NULL AND activity_address IS NULL AND " +
                "activity_hours IS NULL AND seller_delivery IS NULL AND " +
                "pickup IS NULL AND service_area IS NULL) OR " +
                "(completed_step >= 5 AND activity_province_id IS NOT NULL AND " +
                "activity_city_id IS NOT NULL AND " +
                "char_length(btrim(activity_address)) BETWEEN 1 AND 500 AND " +
                "char_length(btrim(activity_hours)) BETWEEN 1 AND 180 AND " +
                "seller_delivery IS NOT NULL AND pickup IS NOT NULL AND " +
                "(seller_delivery OR pickup) AND " +
                "char_length(btrim(service_area)) BETWEEN 1 AND 240)");
    }
}
