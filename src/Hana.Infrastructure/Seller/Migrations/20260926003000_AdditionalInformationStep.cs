using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

[DbContext(typeof(HanaSellerDbContext))]
[Migration("20260926003000_AdditionalInformationStep")]
public sealed class AdditionalInformationStep : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "registration_contact_name",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "registration_contact_role",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "backup_phone",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(11)",
            maxLength: 11,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "website_or_social",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(300)",
            maxLength: 300,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "business_email",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(254)",
            maxLength: 254,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "response_hours",
            schema: "seller",
            table: "registration_drafts",
            type: "character varying(180)",
            maxLength: 180,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_registration_additional_shape",
            schema: "seller",
            table: "registration_drafts",
            sql:
                "(completed_step < 6 AND registration_contact_name IS NULL AND registration_contact_role IS NULL AND backup_phone IS NULL AND website_or_social IS NULL AND business_email IS NULL AND response_hours IS NULL) OR " +
                "(completed_step >= 6 AND char_length(btrim(registration_contact_name)) BETWEEN 1 AND 120 AND (registration_contact_role IS NULL OR char_length(btrim(registration_contact_role)) BETWEEN 1 AND 120) AND (backup_phone IS NULL OR backup_phone ~ '^09[0-9]{9}$') AND (website_or_social IS NULL OR char_length(btrim(website_or_social)) BETWEEN 1 AND 300) AND (business_email IS NULL OR char_length(btrim(business_email)) BETWEEN 3 AND 254) AND char_length(btrim(response_hours)) BETWEEN 1 AND 180)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_registration_additional_shape",
            schema: "seller",
            table: "registration_drafts");

        foreach (var column in new[]
        {
            "registration_contact_name", "registration_contact_role",
            "backup_phone", "website_or_social", "business_email",
            "response_hours"
        })
        {
            migrationBuilder.DropColumn(
                name: column,
                schema: "seller",
                table: "registration_drafts");
        }
    }
}
