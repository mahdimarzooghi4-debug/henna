using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Buyer.Migrations;

[DbContext(typeof(HanaBuyerDbContext))]
[Migration("20260928190000_PurchaseSelectionDraft")]
public sealed class PurchaseSelectionDraft : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            CREATE TABLE buyer.purchase_drafts (
                account_id uuid NOT NULL,
                revision bigint NOT NULL,
                seller_public_id uuid NOT NULL,
                lines_json jsonb NOT NULL,
                is_deleted boolean NOT NULL DEFAULT false,
                updated_at_utc timestamp with time zone NOT NULL,
                CONSTRAINT pk_buyer_purchase_drafts PRIMARY KEY (account_id),
                CONSTRAINT ck_buyer_purchase_drafts_revision CHECK (revision BETWEEN 1 AND 9007199254740991),
                CONSTRAINT ck_buyer_purchase_drafts_seller CHECK ((is_deleted AND seller_public_id = '00000000-0000-0000-0000-000000000000') OR (NOT is_deleted AND seller_public_id <> '00000000-0000-0000-0000-000000000000')),
                CONSTRAINT ck_buyer_purchase_drafts_lines CHECK (jsonb_typeof(lines_json) = 'array' AND ((is_deleted AND jsonb_array_length(lines_json) = 0) OR (NOT is_deleted AND jsonb_array_length(lines_json) BETWEEN 1 AND 100))),
                CONSTRAINT fk_buyer_purchase_drafts_accounts FOREIGN KEY (account_id)
                    REFERENCES identity.accounts (id) ON DELETE RESTRICT
            );
            CREATE TABLE buyer.purchase_draft_idempotency (
                account_id uuid NOT NULL,
                idempotency_key uuid NOT NULL,
                request_sha256 character varying(64) NOT NULL,
                response_json jsonb NOT NULL,
                response_status_code integer NOT NULL,
                created_at_utc timestamp with time zone NOT NULL,
                CONSTRAINT pk_buyer_purchase_draft_idempotency PRIMARY KEY (account_id, idempotency_key),
                CONSTRAINT ck_buyer_purchase_draft_idempotency_key CHECK (idempotency_key <> '00000000-0000-0000-0000-000000000000'),
                CONSTRAINT ck_buyer_purchase_draft_idempotency_hash CHECK (char_length(request_sha256) = 64),
                CONSTRAINT ck_buyer_purchase_draft_idempotency_response CHECK (jsonb_typeof(response_json) = 'object'),
                CONSTRAINT ck_buyer_purchase_draft_idempotency_status CHECK (response_status_code BETWEEN 200 AND 299),
                CONSTRAINT fk_buyer_purchase_draft_idempotency_accounts FOREIGN KEY (account_id)
                    REFERENCES identity.accounts (id) ON DELETE RESTRICT
            );
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS buyer.purchase_draft_idempotency;
            DROP TABLE IF EXISTS buyer.purchase_drafts;
            """);
}
