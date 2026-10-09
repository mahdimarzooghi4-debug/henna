using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261007110000_XGBoostShadowTraining")]
public sealed class XGBoostShadowTraining : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            ALTER TABLE allocation_learning.training_runs
                ADD COLUMN "ShadowModelVersion" character varying(120) NULL,
                ADD COLUMN "ShadowArtifactFormat" character varying(40) NULL,
                ADD COLUMN "ShadowArtifactSha256" character varying(64) NULL,
                ADD COLUMN "ShadowArtifactBytes" bytea NULL,
                ADD COLUMN "ShadowParametersJson" jsonb NULL,
                ADD COLUMN "ShadowMetricsJson" jsonb NULL;

            ALTER TABLE allocation_learning.training_runs
                ADD CONSTRAINT "ck_training_run_shadow_artifact"
                CHECK (
                    (
                        "ShadowModelVersion" IS NULL AND
                        "ShadowArtifactFormat" IS NULL AND
                        "ShadowArtifactSha256" IS NULL AND
                        "ShadowArtifactBytes" IS NULL AND
                        "ShadowParametersJson" IS NULL AND
                        "ShadowMetricsJson" IS NULL
                    )
                    OR
                    (
                        "ShadowModelVersion" IS NOT NULL AND
                        "ShadowArtifactFormat" IS NOT NULL AND
                        "ShadowArtifactSha256" IS NOT NULL AND
                        length("ShadowArtifactSha256") = 64 AND
                        "ShadowArtifactBytes" IS NOT NULL AND
                        octet_length("ShadowArtifactBytes") > 0 AND
                        "ShadowParametersJson" IS NOT NULL AND
                        "ShadowMetricsJson" IS NOT NULL
                    )
                );
            """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            """
            ALTER TABLE allocation_learning.training_runs
                DROP CONSTRAINT "ck_training_run_shadow_artifact",
                DROP COLUMN "ShadowMetricsJson",
                DROP COLUMN "ShadowParametersJson",
                DROP COLUMN "ShadowArtifactBytes",
                DROP COLUMN "ShadowArtifactSha256",
                DROP COLUMN "ShadowArtifactFormat",
                DROP COLUMN "ShadowModelVersion";
            """);
}
