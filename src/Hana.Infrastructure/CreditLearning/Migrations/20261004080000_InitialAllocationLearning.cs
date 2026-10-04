using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261004080000_InitialAllocationLearning")]
public sealed class InitialAllocationLearning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE SCHEMA IF NOT EXISTS allocation_learning;
        CREATE TABLE allocation_learning.assessments (
            "Id" uuid NOT NULL,
            "HouseholdKey" uuid NOT NULL,
            "FormulaVersion" character varying(120) NOT NULL,
            "DatasetVersion" character varying(120) NOT NULL,
            "SourceInstructionReference" character varying(120) NOT NULL,
            "GeographicFactor" numeric NOT NULL,
            "Health" integer NOT NULL,
            "Hardship" integer NOT NULL,
            "Age" integer NOT NULL,
            "Size" integer NOT NULL,
            "Care" integer NOT NULL,
            "Education" integer NOT NULL,
            "AllocatedRial" bigint NOT NULL,
            "AssessedAtUtc" timestamp with time zone NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_assessments" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_assessment_scores" CHECK ("Health" BETWEEN 0 AND 3 AND "Hardship" BETWEEN 0 AND 3 AND "Age" BETWEEN 0 AND 3 AND "Size" BETWEEN 0 AND 3 AND "Care" BETWEEN 0 AND 3 AND "Education" BETWEEN 0 AND 3),
            CONSTRAINT "ck_assessment_amount" CHECK ("AllocatedRial" >= 0 AND "GeographicFactor" > 0)
        );
        CREATE TABLE allocation_learning.outcomes (
            "Id" uuid NOT NULL,
            "SnapshotId" uuid NOT NULL,
            "PeriodStartUtc" timestamp with time zone NOT NULL,
            "PeriodEndUtc" timestamp with time zone NOT NULL,
            "CreditUsedRial" numeric,
            "EssentialNeedsCoverage" numeric,
            "StockBarrier" boolean,
            "DeliveryBarrier" boolean,
            "AccessBarrier" boolean,
            "Evidence" integer NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_outcomes" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_outcome_interval" CHECK ("PeriodEndUtc" > "PeriodStartUtc"),
            CONSTRAINT "ck_outcome_values" CHECK (("CreditUsedRial" IS NULL OR ("CreditUsedRial" >= 0 AND "CreditUsedRial" = trunc("CreditUsedRial"))) AND ("EssentialNeedsCoverage" IS NULL OR "EssentialNeedsCoverage" BETWEEN 0 AND 1) AND "Evidence" BETWEEN 1 AND 3),
            CONSTRAINT "ck_outcome_observed" CHECK ("CreditUsedRial" IS NOT NULL OR "EssentialNeedsCoverage" IS NOT NULL OR "StockBarrier" IS NOT NULL OR "DeliveryBarrier" IS NOT NULL OR "AccessBarrier" IS NOT NULL),
            CONSTRAINT "FK_outcomes_assessments_SnapshotId" FOREIGN KEY ("SnapshotId") REFERENCES allocation_learning.assessments ("Id") ON DELETE RESTRICT
        );
        CREATE INDEX "IX_assessments_HouseholdKey_AssessedAtUtc" ON allocation_learning.assessments ("HouseholdKey", "AssessedAtUtc");
        CREATE INDEX "IX_outcomes_SnapshotId_PeriodEndUtc" ON allocation_learning.outcomes ("SnapshotId", "PeriodEndUtc");
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        "DROP TABLE allocation_learning.outcomes; DROP TABLE allocation_learning.assessments;");
}
