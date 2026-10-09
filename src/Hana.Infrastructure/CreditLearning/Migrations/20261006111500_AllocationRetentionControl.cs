using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006111500_AllocationRetentionControl")]
public sealed class AllocationRetentionControl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.retention_events (
            "Id" uuid NOT NULL,
            "ActorAccountId" uuid NOT NULL,
            "Scope" character varying(40) NOT NULL,
            "CutoffUtc" timestamp with time zone NOT NULL,
            "PreviewDigest" character varying(64) NOT NULL,
            "DeletedSnapshotCount" integer NOT NULL,
            "DeletedOutcomeCount" integer NOT NULL,
            "Reason" character varying(2000) NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_retention_events" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_retention_scope"
                CHECK ("Scope" = 'ATTRIBUTED_RESEARCH'),
            CONSTRAINT "ck_retention_counts"
                CHECK ("DeletedSnapshotCount" > 0 AND "DeletedOutcomeCount" >= 0),
            CONSTRAINT "ck_retention_reason"
                CHECK (length(btrim("Reason")) > 0),
            CONSTRAINT "ck_retention_digest"
                CHECK (length("PreviewDigest") = 64)
        );

        CREATE INDEX "IX_retention_events_RecordedAtUtc_Id"
            ON allocation_learning.retention_events
            ("RecordedAtUtc", "Id");

        CREATE INDEX "IX_retention_events_CutoffUtc_Id"
            ON allocation_learning.retention_events
            ("CutoffUtc", "Id");
        """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.retention_events;");
}
