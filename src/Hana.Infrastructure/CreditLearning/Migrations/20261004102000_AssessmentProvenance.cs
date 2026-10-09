using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace Hana.Infrastructure.CreditLearning.Migrations;
[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261004102000_AssessmentProvenance")]
public sealed class AssessmentProvenance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.assessments
            ADD COLUMN "RecordedByAccountId" uuid,
            ADD COLUMN "EvidenceReference" character varying(240),
            ADD CONSTRAINT "ck_assessment_provenance" CHECK (
                ("RecordedByAccountId" IS NULL AND "EvidenceReference" IS NULL) OR
                ("RecordedByAccountId" IS NOT NULL AND "RecordedByAccountId" <> '00000000-0000-0000-0000-000000000000'::uuid
                 AND "EvidenceReference" IS NOT NULL AND length(btrim("EvidenceReference")) > 0));
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.assessments DROP CONSTRAINT "ck_assessment_provenance",
            DROP COLUMN "EvidenceReference", DROP COLUMN "RecordedByAccountId";
        """);
}
