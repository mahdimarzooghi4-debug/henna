using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Commerce.Migrations;

[DbContext(typeof(HanaCommerceDbContext))]
[Migration("20261025100000_MonoDeliveryCorrelation")]
public sealed class MonoDeliveryCorrelation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            CREATE TABLE commerce.mono_delivery_correlations (
                "OrderId" uuid PRIMARY KEY,
                "IdempotencyKey" character varying(128) NOT NULL,
                "State" character varying(32) NOT NULL,
                "DeliveryRequestId" character varying(64),
                "MissionId" character varying(64),
                "PreparedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "Revision" integer NOT NULL,
                CONSTRAINT ck_mono_delivery_correlation_state
                    CHECK ("State" IN ('PREPARED','REQUEST_RECEIVED','MISSION_LINKED')),
                CONSTRAINT ck_mono_delivery_correlation_revision CHECK ("Revision" > 0),
                CONSTRAINT ck_mono_delivery_correlation_request_state
                    CHECK ("State" = 'PREPARED' OR "DeliveryRequestId" IS NOT NULL),
                CONSTRAINT ck_mono_delivery_correlation_mission_state
                    CHECK ("State" <> 'MISSION_LINKED' OR "MissionId" IS NOT NULL)
            );
            CREATE UNIQUE INDEX "IX_mono_delivery_correlations_IdempotencyKey"
                ON commerce.mono_delivery_correlations ("IdempotencyKey");
            CREATE UNIQUE INDEX "IX_mono_delivery_correlations_DeliveryRequestId"
                ON commerce.mono_delivery_correlations ("DeliveryRequestId");
            CREATE UNIQUE INDEX "IX_mono_delivery_correlations_MissionId"
                ON commerce.mono_delivery_correlations ("MissionId");
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("DROP TABLE commerce.mono_delivery_correlations;");
}
