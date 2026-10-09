using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
[Migration("20261004083000_AllocationProposalReview")]
public sealed class AllocationProposalReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        """
        CREATE TABLE allocation_learning.proposals (
            "Id" uuid NOT NULL,
            "CreatedByAccountId" uuid NOT NULL,
            "CandidateVersion" character varying(120) NOT NULL,
            "ModelVersion" character varying(120) NOT NULL,
            "BaselineVersion" character varying(120) NOT NULL,
            "DatasetVersion" character varying(120) NOT NULL,
            "SourceInstructionReference" character varying(120) NOT NULL,
            "Rationale" character varying(2000) NOT NULL,
            "PoolRial" bigint NOT NULL,
            "WeightsJson" jsonb NOT NULL,
            "SnapshotIdsJson" jsonb NOT NULL,
            "SimulationJson" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_proposals" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_proposal_pool" CHECK ("PoolRial" > 0)
        );
        CREATE TABLE allocation_learning.reviews (
            "Id" uuid NOT NULL,
            "ProposalId" uuid NOT NULL,
            "ReviewerAccountId" uuid NOT NULL,
            "Decision" character varying(16) NOT NULL,
            "Reason" character varying(2000) NOT NULL,
            "ReviewedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_reviews" PRIMARY KEY ("Id"),
            CONSTRAINT "ck_review_decision" CHECK ("Decision" IN ('APPROVED', 'REJECTED')),
            CONSTRAINT "FK_reviews_proposals_ProposalId" FOREIGN KEY ("ProposalId") REFERENCES allocation_learning.proposals ("Id") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX "IX_proposals_CandidateVersion" ON allocation_learning.proposals ("CandidateVersion");
        CREATE INDEX "IX_proposals_CreatedAtUtc_Id" ON allocation_learning.proposals ("CreatedAtUtc", "Id");
        CREATE UNIQUE INDEX "IX_reviews_ProposalId" ON allocation_learning.reviews ("ProposalId");
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(
        "DROP TABLE allocation_learning.reviews; DROP TABLE allocation_learning.proposals;");
}
