using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Buyer.Migrations;

[DbContext(typeof(HanaBuyerDbContext))]
[Migration("20260928160000_ReferenceCart")]
public sealed class ReferenceCart : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            CREATE SCHEMA IF NOT EXISTS buyer;
            CREATE TABLE buyer.reference_carts (
                account_id uuid NOT NULL,
                revision bigint NOT NULL,
                items_json jsonb NOT NULL,
                updated_at_utc timestamp with time zone NOT NULL,
                CONSTRAINT pk_buyer_reference_carts PRIMARY KEY (account_id),
                CONSTRAINT ck_buyer_reference_carts_revision CHECK (revision BETWEEN 1 AND 9007199254740991),
                CONSTRAINT ck_buyer_reference_carts_items CHECK (jsonb_typeof(items_json) = 'array'),
                CONSTRAINT fk_buyer_reference_carts_accounts FOREIGN KEY (account_id)
                    REFERENCES identity.accounts (id) ON DELETE RESTRICT
            );
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("DROP TABLE IF EXISTS buyer.reference_carts;");
}
