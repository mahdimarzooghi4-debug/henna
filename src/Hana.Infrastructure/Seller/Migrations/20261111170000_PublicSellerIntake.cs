using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Seller.Migrations;

/// <summary>
/// A public applicant intake is intentionally NOT a seller account, verified
/// identity, or a registration_draft. It never grants operational access.
/// </summary>
[DbContext(typeof(HanaSellerDbContext))]
[Migration("20261111170000_PublicSellerIntake")]
public sealed class PublicSellerIntake : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE seller.public_registration_intakes (
              id uuid PRIMARY KEY,
              credential_digest varchar(64) NOT NULL UNIQUE,
              payload_sha256 varchar(64) NOT NULL,
              payload_json jsonb NOT NULL,
              tracking_code varchar(24) NOT NULL UNIQUE,
              status varchar(16) NOT NULL DEFAULT 'RECEIVED',
              submitted_at_utc timestamptz NOT NULL,
              CONSTRAINT ck_public_intakes_status CHECK (status = 'RECEIVED'),
              CONSTRAINT ck_public_intakes_digest CHECK (
                credential_digest ~ '^[0-9A-F]{64}$' AND
                payload_sha256 ~ '^[0-9A-F]{64}$'),
              CONSTRAINT ck_public_intakes_tracking CHECK (
                tracking_code ~ '^HNA-P-[0-9A-F]{16}$'),
              CONSTRAINT ck_public_intakes_json_object CHECK (
                jsonb_typeof(payload_json) = 'object')
            );
            CREATE INDEX ix_public_intakes_submitted
                ON seller.public_registration_intakes(submitted_at_utc DESC);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE seller.public_registration_intakes;");
    }
}
