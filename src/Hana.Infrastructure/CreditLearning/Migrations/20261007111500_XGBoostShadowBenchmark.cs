using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261007111500_XGBoostShadowBenchmark")]
public sealed class XGBoostShadowBenchmark : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            CREATE TABLE allocation_learning.shadow_model_benchmarks (
                "Id" uuid NOT NULL,
                "TrainingRunId" uuid NOT NULL,
                "EvaluatedByAccountId" uuid NOT NULL,
                "ProtocolVersion" character varying(120) NOT NULL,
                "ModelVersion" character varying(120) NOT NULL,
                "ArtifactSha256" character varying(64) NOT NULL,
                "BaselineVersion" character varying(120) NOT NULL,
                "DatasetVersion" character varying(120) NOT NULL,
                "SourceInstructionReference" character varying(120) NOT NULL,
                "RuntimeProposalId" uuid NULL,
                "RuntimeProfileSequence" bigint NULL,
                "EvaluationLabelIdsJson" jsonb NOT NULL,
                "EvaluationFingerprint" character varying(64) NOT NULL,
                "MetricsJson" jsonb NOT NULL,
                "CutoffUtc" timestamp with time zone NOT NULL,
                "RecordedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_shadow_model_benchmarks"
                    PRIMARY KEY ("Id"),
                CONSTRAINT "FK_shadow_model_benchmarks_training_runs_TrainingRunId"
                    FOREIGN KEY ("TrainingRunId")
                    REFERENCES allocation_learning.training_runs ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "FK_shadow_model_benchmarks_proposals_RuntimeProposalId"
                    FOREIGN KEY ("RuntimeProposalId")
                    REFERENCES allocation_learning.proposals ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "ck_shadow_model_benchmark_fingerprint"
                    CHECK (
                        length("EvaluationFingerprint") = 64 AND
                        length("ArtifactSha256") = 64
                    )
            );

            CREATE INDEX
                "IX_shadow_model_benchmarks_EvaluationFingerprint_RecordedAtUtc_Id"
                ON allocation_learning.shadow_model_benchmarks
                ("EvaluationFingerprint","RecordedAtUtc","Id");

            CREATE UNIQUE INDEX
                "UX_shadow_model_benchmarks_TrainingRunId_EvaluationFingerprint"
                ON allocation_learning.shadow_model_benchmarks
                ("TrainingRunId","EvaluationFingerprint");

            CREATE INDEX
                "IX_shadow_model_benchmarks_RuntimeProposalId"
                ON allocation_learning.shadow_model_benchmarks
                ("RuntimeProposalId");
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.shadow_model_benchmarks;");
}
