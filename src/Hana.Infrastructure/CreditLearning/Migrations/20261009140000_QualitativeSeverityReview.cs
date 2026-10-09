using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261009140000_QualitativeSeverityReview")]
public sealed class QualitativeSeverityReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.qualitative_severity_reviews (
            "Id" uuid NOT NULL PRIMARY KEY,
            "SevenFactorReviewId" uuid NOT NULL REFERENCES
                allocation_learning.reviewed_seven_factor_assessments ("Id") ON DELETE RESTRICT,
            "SnapshotId" uuid NOT NULL REFERENCES
                allocation_learning.assessments ("Id") ON DELETE RESTRICT,
            "ReviewerAccountId" uuid NOT NULL,
            "ScaleVersion" varchar(120) NOT NULL,
            "CriteriaVersion" varchar(120) NOT NULL,
            "SourceFormulaVersion" varchar(120) NOT NULL,
            "SourceDatasetVersion" varchar(120) NOT NULL,
            "SourceInstructionReference" varchar(120) NOT NULL,
            "EvidenceDisposition" integer NOT NULL,
            "SeverityLevel" integer NULL,
            "HumanSelectedBasis" integer NULL,
            "EvidenceReference" varchar(240) NOT NULL,
            "EvidenceObservedAtUtc" timestamp with time zone NOT NULL,
            "Rationale" varchar(2000) NOT NULL,
            "ReviewedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "ck_qualitative_scale_version"
                CHECK ("ScaleVersion" = 'HENNA-NEED-SEVERITY-FIVE-LEVEL-SCALE-v1'
                    AND "CriteriaVersion" = 'HENNA-NEED-SEVERITY-QUALITATIVE-CRITERIA-v1'),
            CONSTRAINT "ck_qualitative_level_basis"
                CHECK (("EvidenceDisposition" = 1 AND "SeverityLevel" BETWEEN 0 AND 4
                    AND "HumanSelectedBasis" = "SeverityLevel")
                    OR ("EvidenceDisposition" IN (2,3) AND "SeverityLevel" IS NULL
                    AND "HumanSelectedBasis" IS NULL)),
            CONSTRAINT "ck_qualitative_evidence"
                CHECK ("ReviewerAccountId" <> '00000000-0000-0000-0000-000000000000'::uuid
                    AND length(btrim("EvidenceReference")) > 0
                    AND length(btrim("Rationale")) > 0
                    AND "EvidenceObservedAtUtc" <= "ReviewedAtUtc")
        );
        CREATE INDEX "IX_qualitative_severity_SevenFactorReviewId_ReviewedAtUtc_Id"
            ON allocation_learning.qualitative_severity_reviews
            ("SevenFactorReviewId","ReviewedAtUtc","Id");
        CREATE INDEX "IX_qualitative_severity_reviews_SnapshotId"
            ON allocation_learning.qualitative_severity_reviews ("SnapshotId");
        CREATE FUNCTION allocation_learning.reject_qualitative_severity_review_rewrite()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Reviewed need severity is append-only';
        END;
        $$;
        CREATE TRIGGER "TR_qualitative_severity_reviews_append_only"
            BEFORE UPDATE OR DELETE ON allocation_learning.qualitative_severity_reviews
            FOR EACH ROW EXECUTE FUNCTION
                allocation_learning.reject_qualitative_severity_review_rewrite();
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        DROP TABLE allocation_learning.qualitative_severity_reviews;
        DROP FUNCTION allocation_learning.reject_qualitative_severity_review_rewrite();
        """);
}
