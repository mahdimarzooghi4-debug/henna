using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Commerce.Migrations;

[DbContext(typeof(HanaCommerceDbContext))]
[Migration("20261025130000_MonoDeliveryRequestFingerprint")]
public sealed class MonoDeliveryRequestFingerprint : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "RequestFingerprint",
            schema: "commerce",
            table: "mono_delivery_correlations",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "ck_mono_delivery_request_fingerprint",
            schema: "commerce",
            table: "mono_delivery_correlations",
            sql: "\"RequestFingerprint\" IS NULL OR \"RequestFingerprint\" ~ '^[0-9a-f]{64}$'");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_mono_delivery_request_fingerprint",
            schema: "commerce",
            table: "mono_delivery_correlations");
        migrationBuilder.DropColumn(
            name: "RequestFingerprint",
            schema: "commerce",
            table: "mono_delivery_correlations");
    }
}
