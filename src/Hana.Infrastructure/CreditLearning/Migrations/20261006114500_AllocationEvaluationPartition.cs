using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006114500_AllocationEvaluationPartition")]
public sealed class AllocationEvaluationPartition : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.need_labels
            DROP CONSTRAINT "ck_need_label";

        ALTER TABLE allocation_learning.need_labels
            ADD CONSTRAINT "ck_need_label"
            CHECK ("NeedScore" BETWEEN 0 AND 1 AND "Partition" IN (1, 2, 3));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        ALTER TABLE allocation_learning.need_labels
            DROP CONSTRAINT "ck_need_label";

        ALTER TABLE allocation_learning.need_labels
            ADD CONSTRAINT "ck_need_label"
            CHECK ("NeedScore" BETWEEN 0 AND 1 AND "Partition" IN (1, 2));
        """);
}
