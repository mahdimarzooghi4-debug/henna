using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006113000_AllocationReviewedOutcomeProvenance")]
public sealed class AllocationReviewedOutcomeProvenance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            ALTER TABLE allocation_learning.outcomes
                ADD COLUMN "ReviewedByAccountId" uuid NULL,
                ADD COLUMN "EvidenceReference" character varying(240) NULL;

            ALTER TABLE allocation_learning.outcomes
                ADD CONSTRAINT "ck_outcome_review_provenance"
                CHECK (
                    ("Evidence" = 3
                        AND "ReviewedByAccountId" IS NOT NULL
                        AND "ReviewedByAccountId" <> '00000000-0000-0000-0000-000000000000'::uuid
                        AND "EvidenceReference" IS NOT NULL
                        AND length(btrim("EvidenceReference")) > 0)
                    OR
                    ("Evidence" <> 3
                        AND "ReviewedByAccountId" IS NULL
                        AND "EvidenceReference" IS NULL)
                ),
                ADD CONSTRAINT "ck_outcome_reviewed_nonfinancial"
                CHECK ("Evidence" <> 3 OR "CreditUsedRial" IS NULL);
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            ALTER TABLE allocation_learning.outcomes
                DROP CONSTRAINT "ck_outcome_reviewed_nonfinancial",
                DROP CONSTRAINT "ck_outcome_review_provenance",
                DROP COLUMN "EvidenceReference",
                DROP COLUMN "ReviewedByAccountId";
            """);
}
