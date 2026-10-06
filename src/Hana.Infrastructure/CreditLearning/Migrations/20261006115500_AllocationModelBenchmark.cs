using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006115500_AllocationModelBenchmark")]
public sealed class AllocationModelBenchmark : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.model_benchmarks (
            "Id" uuid NOT NULL,
            "ProposalId" uuid NOT NULL,
            "EvaluatedByAccountId" uuid NOT NULL,
            "ProtocolVersion" character varying(120) NOT NULL,
            "ModelVersion" character varying(120) NOT NULL,
            "BaselineVersion" character varying(120) NOT NULL,
            "CandidateVersion" character varying(120) NOT NULL,
            "DatasetVersion" character varying(120) NOT NULL,
            "SourceInstructionReference" character varying(120) NOT NULL,
            "RuntimeProposalId" uuid NULL,
            "RuntimeProfileSequence" bigint NULL,
            "EvaluationLabelIdsJson" jsonb NOT NULL,
            "EvaluationFingerprint" character varying(64) NOT NULL,
            "MetricsJson" jsonb NOT NULL,
            "CutoffUtc" timestamp with time zone NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_model_benchmarks" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_model_benchmarks_proposals_ProposalId"
                FOREIGN KEY ("ProposalId")
                REFERENCES allocation_learning.proposals ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "FK_model_benchmarks_proposals_RuntimeProposalId"
                FOREIGN KEY ("RuntimeProposalId")
                REFERENCES allocation_learning.proposals ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "ck_model_benchmark_fingerprint"
                CHECK (length("EvaluationFingerprint") = 64)
        );

        CREATE INDEX "IX_model_benchmarks_EvaluationFingerprint_RecordedAtUtc_Id"
            ON allocation_learning.model_benchmarks
            ("EvaluationFingerprint","RecordedAtUtc","Id");

        CREATE UNIQUE INDEX "UX_model_benchmarks_ProposalId_EvaluationFingerprint"
            ON allocation_learning.model_benchmarks
            ("ProposalId","EvaluationFingerprint");
        """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.model_benchmarks;");
}
