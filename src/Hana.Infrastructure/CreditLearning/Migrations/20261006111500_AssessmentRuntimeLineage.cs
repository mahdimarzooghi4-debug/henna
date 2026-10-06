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
            ADD COLUMN "RuntimeProposalId" uuid NULL;

        CREATE INDEX "IX_assessments_FormulaVersion_RuntimeProposalId"
            ON allocation_learning.assessments
            ("FormulaVersion", "RuntimeProposalId");

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

        DROP INDEX allocation_learning."IX_assessments_FormulaVersion_RuntimeProposalId";

        ALTER TABLE allocation_learning.assessments
            DROP COLUMN "RuntimeProposalId";
        """);
}
