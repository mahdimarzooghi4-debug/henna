using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260920210000_OtpDeliveryStatus")]
public sealed class OtpDeliveryStatus : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "delivery_status",
            schema: "identity",
            table: "otp_challenges",
            type: "character varying(16)",
            maxLength: 16,
            nullable: false,
            defaultValue: "PENDING");

        migrationBuilder.AddCheckConstraint(
            name: "ck_otp_delivery_state",
            schema: "identity",
            table: "otp_challenges",
            sql: "delivery_status IN ('PENDING', 'ACCEPTED', 'FAILED')");

        migrationBuilder.AddCheckConstraint(
            name: "ck_otp_accepted_has_reference",
            schema: "identity",
            table: "otp_challenges",
            sql: "delivery_status <> 'ACCEPTED' OR provider_message_reference IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_otp_accepted_has_reference", schema: "identity",
            table: "otp_challenges");
        migrationBuilder.DropCheckConstraint(
            name: "ck_otp_delivery_state", schema: "identity",
            table: "otp_challenges");
        migrationBuilder.DropColumn(
            name: "delivery_status", schema: "identity", table: "otp_challenges");
    }
}
