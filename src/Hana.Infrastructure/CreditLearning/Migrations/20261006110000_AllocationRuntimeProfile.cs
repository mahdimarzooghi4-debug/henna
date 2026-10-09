using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006110000_AllocationRuntimeProfile")]
public sealed class AllocationRuntimeProfile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.runtime_profile_events (
            "Id" uuid NOT NULL,
            "ProposalId" uuid NOT NULL,
            "ActorAccountId" uuid NOT NULL,
            "Sequence" bigint NOT NULL,
            "EventType" character varying(32) NOT NULL,
            "EffectiveProposalId" uuid NULL,
            "EffectiveProfileVersion" character varying(120) NOT NULL,
            "EffectiveWeightsJson" jsonb NOT NULL,
            "PreviousProposalId" uuid NULL,
            "PreviousProfileVersion" character varying(120) NOT NULL,
            "PreviousWeightsJson" jsonb NOT NULL,
            "Reason" character varying(2000) NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_runtime_profile_events" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_runtime_profile_events_proposals_ProposalId"
                FOREIGN KEY ("ProposalId")
                REFERENCES allocation_learning.proposals ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "ck_runtime_profile_event_type"
                CHECK ("EventType" IN ('RUNTIME_PROMOTED','RUNTIME_ROLLED_BACK')),
            CONSTRAINT "ck_runtime_profile_versions"
                CHECK (
                    length(btrim("EffectiveProfileVersion")) > 0
                    AND length(btrim("PreviousProfileVersion")) > 0
                ),
            CONSTRAINT "ck_runtime_profile_reason"
                CHECK (length(btrim("Reason")) > 0)
        );

        CREATE UNIQUE INDEX "UX_runtime_profile_sequence"
            ON allocation_learning.runtime_profile_events ("Sequence");

        CREATE INDEX "IX_runtime_profile_events_RecordedAtUtc_Id"
            ON allocation_learning.runtime_profile_events ("RecordedAtUtc", "Id");

        CREATE UNIQUE INDEX "UX_runtime_profile_promoted"
            ON allocation_learning.runtime_profile_events ("ProposalId")
            WHERE "EventType" = 'RUNTIME_PROMOTED';

        CREATE UNIQUE INDEX "UX_runtime_profile_rolled_back"
            ON allocation_learning.runtime_profile_events ("ProposalId")
            WHERE "EventType" = 'RUNTIME_ROLLED_BACK';
        """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.runtime_profile_events;");
}
