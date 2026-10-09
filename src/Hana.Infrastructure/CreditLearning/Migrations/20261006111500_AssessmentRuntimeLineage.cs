using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006111500_AssessmentRuntimeLineage")]
public sealed class AssessmentRuntimeLineage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.assessments
            ADD COLUMN "RuntimeProposalId" uuid NULL,
            ADD COLUMN "RuntimeProfileSequence" bigint NULL,
            ADD CONSTRAINT "ck_assessment_runtime_sequence"
                CHECK ("RuntimeProfileSequence" IS NULL OR "RuntimeProfileSequence" >= 0);

        CREATE INDEX "IX_assessments_FormulaVersion_RuntimeProposalId_RuntimeProfileSequence"
            ON allocation_learning.assessments
            ("FormulaVersion", "RuntimeProposalId", "RuntimeProfileSequence");

        CREATE INDEX "IX_assessments_RuntimeProposalId"
            ON allocation_learning.assessments ("RuntimeProposalId");

        ALTER TABLE allocation_learning.assessments
            ADD CONSTRAINT "FK_assessments_proposals_RuntimeProposalId"
            FOREIGN KEY ("RuntimeProposalId")
            REFERENCES allocation_learning.proposals ("Id")
            ON DELETE RESTRICT;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.assessments
            DROP CONSTRAINT "FK_assessments_proposals_RuntimeProposalId";

        DROP INDEX allocation_learning."IX_assessments_RuntimeProposalId";

        DROP INDEX allocation_learning."IX_assessments_FormulaVersion_RuntimeProposalId_RuntimeProfileSequence";

        ALTER TABLE allocation_learning.assessments
            DROP CONSTRAINT "ck_assessment_runtime_sequence",
            DROP COLUMN "RuntimeProfileSequence",
            DROP COLUMN "RuntimeProposalId";
        """);
}
