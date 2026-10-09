using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261004090000_TrainingAudit")]
public sealed class TrainingAudit : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.need_labels (
            "Id" uuid NOT NULL,
            "SnapshotId" uuid NOT NULL,
            "ReviewerAccountId" uuid NOT NULL,
            "NeedScore" numeric NOT NULL,
            "RubricVersion" character varying(120) NOT NULL,
            "Partition" integer NOT NULL,
            "ReviewedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_need_labels" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_need_label" CHECK ("NeedScore" BETWEEN 0 AND 1 AND "Partition" IN (1, 2)),
            CONSTRAINT "FK_need_labels_assessments_SnapshotId" FOREIGN KEY ("SnapshotId") REFERENCES allocation_learning.assessments ("Id") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX "IX_need_labels_SnapshotId_RubricVersion" ON allocation_learning.need_labels ("SnapshotId", "RubricVersion");
        CREATE TABLE allocation_learning.training_runs (
            "Id" uuid NOT NULL,
            "RequestedByAccountId" uuid NOT NULL,
            "ProposalId" uuid,
            "Status" character varying(24) NOT NULL,
            "DatasetVersion" character varying(120) NOT NULL,
            "ModelVersion" character varying(120) NOT NULL,
            "InputsJson" jsonb NOT NULL,
            "MetricsJson" jsonb,
            "CutoffUtc" timestamp with time zone NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_training_runs" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_training_run" CHECK (("Status" = 'PROPOSED' AND "ProposalId" IS NOT NULL AND "MetricsJson" IS NOT NULL) OR ("Status" = 'NO_IMPROVEMENT' AND "ProposalId" IS NULL)),
            CONSTRAINT "FK_training_runs_proposals_ProposalId" FOREIGN KEY ("ProposalId") REFERENCES allocation_learning.proposals ("Id") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX "IX_training_runs_ProposalId" ON allocation_learning.training_runs ("ProposalId");
        CREATE INDEX "IX_training_runs_RecordedAtUtc_Id" ON allocation_learning.training_runs ("RecordedAtUtc", "Id");
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        "DROP TABLE allocation_learning.training_runs; DROP TABLE allocation_learning.need_labels;");
}
