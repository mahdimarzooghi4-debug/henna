using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261006104500_AllocationProductionControl")]
public sealed class AllocationProductionControl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.production_control_events (
            "Id" uuid NOT NULL,
            "ProposalId" uuid NOT NULL,
            "ActorAccountId" uuid NOT NULL,
            "EventType" character varying(40) NOT NULL,
            "Reason" character varying(2000) NOT NULL,
            "RecordedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_production_control_events" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_production_control_events_proposals_ProposalId"
                FOREIGN KEY ("ProposalId")
                REFERENCES allocation_learning.proposals ("Id")
                ON DELETE RESTRICT,
            CONSTRAINT "ck_production_control_event_type"
                CHECK ("EventType" IN ('PRODUCTION_ACTIVATION_AUTHORIZED','PRODUCTION_ROLLBACK_AUTHORIZED')),
            CONSTRAINT "ck_production_control_reason"
                CHECK (length(btrim("Reason")) > 0)
        );

        CREATE INDEX "IX_production_control_events_ProposalId_RecordedAtUtc_Id"
            ON allocation_learning.production_control_events
            ("ProposalId", "RecordedAtUtc", "Id");

        CREATE UNIQUE INDEX "UX_production_control_activation"
            ON allocation_learning.production_control_events ("ProposalId")
            WHERE "EventType" = 'PRODUCTION_ACTIVATION_AUTHORIZED';

        CREATE UNIQUE INDEX "UX_production_control_rollback"
            ON allocation_learning.production_control_events ("ProposalId")
            WHERE "EventType" = 'PRODUCTION_ROLLBACK_AUTHORIZED';
        """);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(
            "DROP TABLE allocation_learning.production_control_events;");
}
