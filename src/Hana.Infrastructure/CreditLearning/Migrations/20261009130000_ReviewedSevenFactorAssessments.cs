using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261009130000_ReviewedSevenFactorAssessments")]
public sealed class ReviewedSevenFactorAssessments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.reviewed_seven_factor_assessments (
            "Id" uuid NOT NULL,
            "SnapshotId" uuid NOT NULL,
            "ReviewerAccountId" uuid NOT NULL,
            "FormulaVersion" character varying(120) NOT NULL,
            "SourceFormulaVersion" character varying(120) NOT NULL,
            "SourceDatasetVersion" character varying(120) NOT NULL,
            "SourceInstructionReference" character varying(120) NOT NULL,
            "Health" integer NOT NULL,
            "NonHousingHardship" integer NOT NULL,
            "Age" integer NOT NULL,
            "Size" integer NOT NULL,
            "Care" integer NOT NULL,
            "Education" integer NOT NULL,
            "HousingTenure" integer NOT NULL,
            "HousingEvidenceReference" character varying(240) NOT NULL,
            "NonHousingHardshipEvidenceReference" character varying(240) NOT NULL,
            "OtherNeedsEvidenceReference" character varying(240) NOT NULL,
            "OriginalGeographicFactor" numeric NOT NULL,
            "ReviewedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_reviewed_seven_factor_assessments" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_reviewed_seven_factor_assessments_assessments_SnapshotId"
                FOREIGN KEY ("SnapshotId") REFERENCES allocation_learning.assessments ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "ck_seven_factor_review_version"
                CHECK ("FormulaVersion" = 'HANA-NEEDS-BASED-ALLOCATION-v1.1'),
            CONSTRAINT "ck_seven_factor_review_scores"
                CHECK ("Health" BETWEEN 0 AND 3
                    AND "NonHousingHardship" BETWEEN 0 AND 3
                    AND "Age" BETWEEN 0 AND 3
                    AND "Size" BETWEEN 0 AND 3
                    AND "Care" BETWEEN 0 AND 3
                    AND "Education" BETWEEN 0 AND 3
                    AND "HousingTenure" IN (1,2)),
            CONSTRAINT "ck_seven_factor_review_evidence"
                CHECK ("ReviewerAccountId" <> '00000000-0000-0000-0000-000000000000'::uuid
                    AND length(btrim("HousingEvidenceReference")) > 0
                    AND length(btrim("NonHousingHardshipEvidenceReference")) > 0
                    AND length(btrim("OtherNeedsEvidenceReference")) > 0
                    AND "OriginalGeographicFactor" > 0)
        );
        CREATE INDEX "IX_seven_factor_review_SnapshotId_ReviewedAtUtc_Id"
            ON allocation_learning.reviewed_seven_factor_assessments
                ("SnapshotId","ReviewedAtUtc","Id");

        CREATE FUNCTION allocation_learning.reject_seven_factor_review_rewrite()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Reviewed seven-factor assessment records are append-only';
        END;
        $$;
        CREATE TRIGGER "TR_reviewed_seven_factor_append_only"
            BEFORE UPDATE OR DELETE
            ON allocation_learning.reviewed_seven_factor_assessments
            FOR EACH ROW EXECUTE FUNCTION
                allocation_learning.reject_seven_factor_review_rewrite();
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        DROP TABLE allocation_learning.reviewed_seven_factor_assessments;
        DROP FUNCTION allocation_learning.reject_seven_factor_review_rewrite();
        """);
}
