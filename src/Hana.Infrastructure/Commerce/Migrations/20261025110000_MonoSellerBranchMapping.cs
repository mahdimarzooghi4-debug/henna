using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Commerce.Migrations;

[DbContext(typeof(HanaCommerceDbContext))]
[Migration("20261025110000_MonoSellerBranchMapping")]
public sealed class MonoSellerBranchMappingMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("""
            CREATE TABLE commerce.mono_seller_branch_mappings (
                "SellerId" uuid PRIMARY KEY,
                "MonoBranchId" character varying(35) NOT NULL,
                "Revision" integer NOT NULL,
                "UpdatedByAccountId" uuid NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT ck_mono_seller_branch_mapping_revision CHECK ("Revision" > 0),
                CONSTRAINT ck_mono_seller_branch_mapping_id
                    CHECK ("MonoBranchId" ~ '^br_[0-9a-f]{32}$')
            );
            CREATE INDEX "IX_mono_seller_branch_mappings_MonoBranchId"
                ON commerce.mono_seller_branch_mappings ("MonoBranchId");
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("DROP TABLE commerce.mono_seller_branch_mappings;");
}
