using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006103000_AllocationPilotLifecycle")]
public sealed class AllocationPilotLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.pilot_events (
            "Id" uuid NOT NULL,
            "ProposalId" uuid NOT NULL,
            "ActorAccountId" uuid NOT NULL,
            "EventType" character varying(24) NOT NULL,
            "ScopeReference" character varying(240) NULL,
            "Reason" character varying(2000) NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_pilot_events" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_pilot_events_proposals_ProposalId"
                FOREIGN KEY ("ProposalId")
                REFERENCES allocation_learning.proposals ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "ck_pilot_event_type"
                CHECK ("EventType" IN ('PILOT_AUTHORIZED','PILOT_COMPLETED','PILOT_ABORTED')),
            CONSTRAINT "ck_pilot_event_scope"
                CHECK (
                    ("EventType" = 'PILOT_AUTHORIZED'
                        AND "ScopeReference" IS NOT NULL
                        AND length(btrim("ScopeReference")) > 0)
                    OR
                    ("EventType" IN ('PILOT_COMPLETED','PILOT_ABORTED')
                        AND "ScopeReference" IS NULL)
                ),
            CONSTRAINT "ck_pilot_event_reason"
                CHECK (length(btrim("Reason")) > 0)
        );

        CREATE INDEX "IX_pilot_events_ProposalId_RecordedAtUtc_Id"
            ON allocation_learning.pilot_events
            ("ProposalId", "RecordedAtUtc", "Id");

        CREATE UNIQUE INDEX "UX_pilot_events_authorized"
            ON allocation_learning.pilot_events ("ProposalId")
            WHERE "EventType" = 'PILOT_AUTHORIZED';

        CREATE UNIQUE INDEX "UX_pilot_events_terminal"
            ON allocation_learning.pilot_events ("ProposalId")
            WHERE "EventType" IN ('PILOT_COMPLETED','PILOT_ABORTED');
        """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.pilot_events;");
}
