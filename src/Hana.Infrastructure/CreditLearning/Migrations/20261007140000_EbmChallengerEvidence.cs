using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261007140000_EbmChallengerEvidence")]
public sealed class EbmChallengerEvidence : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            CREATE TABLE allocation_learning.ebm_artifacts (
                "Id" uuid NOT NULL,
                "TrainingRunId" uuid NOT NULL,
                "RegisteredByAccountId" uuid NOT NULL,
                "ModelVersion" character varying(120) NOT NULL,
                "ArtifactFormat" character varying(80) NOT NULL,
                "ArtifactSha256" character varying(64) NOT NULL,
                "ArtifactBytes" bytea NOT NULL,
                "LibraryName" character varying(80) NOT NULL,
                "LibraryVersion" character varying(40) NOT NULL,
                "ReportJson" jsonb NOT NULL,
                "RecordedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_ebm_artifacts" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ebm_artifacts_training_runs_TrainingRunId"
                    FOREIGN KEY ("TrainingRunId")
                    REFERENCES allocation_learning.training_runs ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "ck_ebm_artifact"
                    CHECK (
                        "ModelVersion" = 'henna-ebm-v1-offline' AND
                        "ArtifactFormat" = 'henna-ebm-portable-json-v1' AND
                        "LibraryName" = 'interpret-core' AND
                        "LibraryVersion" = '0.7.8' AND
                        length("ArtifactSha256") = 64 AND
                        octet_length("ArtifactBytes") > 0
                    )
            );

            CREATE UNIQUE INDEX "UX_ebm_artifacts_TrainingRunId"
                ON allocation_learning.ebm_artifacts ("TrainingRunId");
            CREATE INDEX "IX_ebm_artifacts_RecordedAtUtc_Id"
                ON allocation_learning.ebm_artifacts ("RecordedAtUtc","Id");

            CREATE TABLE allocation_learning.ebm_model_benchmarks (
                "Id" uuid NOT NULL,
                "EbmArtifactId" uuid NOT NULL,
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
                CONSTRAINT "PK_ebm_model_benchmarks" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ebm_model_benchmarks_ebm_artifacts_EbmArtifactId"
                    FOREIGN KEY ("EbmArtifactId")
                    REFERENCES allocation_learning.ebm_artifacts ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "FK_ebm_model_benchmarks_training_runs_TrainingRunId"
                    FOREIGN KEY ("TrainingRunId")
                    REFERENCES allocation_learning.training_runs ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "FK_ebm_model_benchmarks_proposals_RuntimeProposalId"
                    FOREIGN KEY ("RuntimeProposalId")
                    REFERENCES allocation_learning.proposals ("Id")
                    ON DELETE RESTRICT,
                CONSTRAINT "ck_ebm_model_benchmark"
                    CHECK (
                        length("EvaluationFingerprint") = 64 AND
                        length("ArtifactSha256") = 64
                    )
            );

            CREATE INDEX
                "IX_ebm_model_benchmarks_EvaluationFingerprint_RecordedAtUtc_Id"
                ON allocation_learning.ebm_model_benchmarks
                ("EvaluationFingerprint","RecordedAtUtc","Id");
            CREATE UNIQUE INDEX
                "UX_ebm_model_benchmarks_EbmArtifactId_EvaluationFingerprint"
                ON allocation_learning.ebm_model_benchmarks
                ("EbmArtifactId","EvaluationFingerprint");
            CREATE INDEX
                "IX_ebm_model_benchmarks_TrainingRunId"
                ON allocation_learning.ebm_model_benchmarks ("TrainingRunId");
            CREATE INDEX
                "IX_ebm_model_benchmarks_RuntimeProposalId"
                ON allocation_learning.ebm_model_benchmarks ("RuntimeProposalId");
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            DROP TABLE allocation_learning.ebm_model_benchmarks;
            DROP TABLE allocation_learning.ebm_artifacts;
            """);
}


[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261007143000_RegressionBenchmarkDiagnostics")]
public sealed class RegressionBenchmarkDiagnostics : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            DROP INDEX allocation_learning."UX_model_benchmarks_ProposalId_EvaluationFingerprint";
            CREATE UNIQUE INDEX
                "UX_model_benchmarks_ProposalId_EvaluationFingerprint_ProtocolVersion"
                ON allocation_learning.model_benchmarks
                ("ProposalId","EvaluationFingerprint","ProtocolVersion");

            DROP INDEX allocation_learning."UX_shadow_model_benchmarks_TrainingRunId_EvaluationFingerprint";
            CREATE UNIQUE INDEX
                "UX_shadow_model_benchmarks_TrainingRunId_EvaluationFingerprint_ProtocolVersion"
                ON allocation_learning.shadow_model_benchmarks
                ("TrainingRunId","EvaluationFingerprint","ProtocolVersion");

            DROP INDEX allocation_learning."UX_ebm_model_benchmarks_EbmArtifactId_EvaluationFingerprint";
            CREATE UNIQUE INDEX
                "UX_ebm_model_benchmarks_EbmArtifactId_EvaluationFingerprint_ProtocolVersion"
                ON allocation_learning.ebm_model_benchmarks
                ("EbmArtifactId","EvaluationFingerprint","ProtocolVersion");
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            DROP INDEX allocation_learning."UX_model_benchmarks_ProposalId_EvaluationFingerprint_ProtocolVersion";
            CREATE UNIQUE INDEX
                "UX_model_benchmarks_ProposalId_EvaluationFingerprint"
                ON allocation_learning.model_benchmarks
                ("ProposalId","EvaluationFingerprint");

            DROP INDEX allocation_learning."UX_shadow_model_benchmarks_TrainingRunId_EvaluationFingerprint_ProtocolVersion";
            CREATE UNIQUE INDEX
                "UX_shadow_model_benchmarks_TrainingRunId_EvaluationFingerprint"
                ON allocation_learning.shadow_model_benchmarks
                ("TrainingRunId","EvaluationFingerprint");

            DROP INDEX allocation_learning."UX_ebm_model_benchmarks_EbmArtifactId_EvaluationFingerprint_ProtocolVersion";
            CREATE UNIQUE INDEX
                "UX_ebm_model_benchmarks_EbmArtifactId_EvaluationFingerprint"
                ON allocation_learning.ebm_model_benchmarks
                ("EbmArtifactId","EvaluationFingerprint");
            """);
}
