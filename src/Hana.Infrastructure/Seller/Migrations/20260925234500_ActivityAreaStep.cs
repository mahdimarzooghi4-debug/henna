using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260925234500_ActivityAreaStep")]
public sealed class ActivityAreaStep : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "activity_province_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "activity_city_id",
            schema: "seller",
            table: "registration_drafts",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "activity_address",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "activity_hours",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(180)",
            maxLength: 180,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "seller_delivery",
            schema: "seller",
            table: "registration_drafts",
            type: "boolean",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "pickup",
            schema: "seller",
            table: "registration_drafts",
            type: "boolean",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "service_area",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(240)",
            maxLength: 240,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_activity_shape",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(completed_step < 5 AND activity_province_id IS NULL AND activity_city_id IS NULL AND activity_address IS NULL AND activity_hours IS NULL AND seller_delivery IS NULL AND pickup IS NULL AND service_area IS NULL) OR " +
                "(completed_step >= 5 AND activity_province_id IS NOT NULL AND activity_city_id IS NOT NULL AND char_length(btrim(activity_address)) BETWEEN 1 AND 500 AND char_length(btrim(activity_hours)) BETWEEN 1 AND 180 AND seller_delivery IS NOT NULL AND pickup IS NOT NULL AND (seller_delivery OR pickup) AND char_length(btrim(service_area)) BETWEEN 1 AND 240)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_activity_shape",
            schema: "seller",
            table: "registration_drafts");

        foreach (var column in new[]
        {
            "activity_province_id", "activity_city_id", "activity_address",
            "activity_hours", "seller_delivery", "pickup", "service_area"
        })
        {
            migrationBuilder.DropColumn(
                name: column,
                schema: "seller",
                table: "registration_drafts");
        }
    }
}
