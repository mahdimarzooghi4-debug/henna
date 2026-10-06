using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.CreditLearning.Migrations;

[DbContext(typeof(HanaAllocationLearningDbContext))]
public sealed class HanaAllocationLearningDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("allocation_learning");
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        modelBuilder.HasAnnotation("Relational:MaxIdentifierLength", 63);
        modelBuilder.UseIdentityByDefaultColumns();
        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationAssessmentRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("HouseholdKey").HasColumnType("uuid");
            e.Property<Guid?>("RecordedByAccountId").HasColumnType("uuid");
            e.Property<string>("EvidenceReference").HasMaxLength(240).HasColumnType("character varying(240)");
            e.Property<string>("FormulaVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<Guid?>("RuntimeProposalId").HasColumnType("uuid");
            e.Property<long?>("RuntimeProfileSequence").HasColumnType("bigint");
            e.Property<string>("DatasetVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("SourceInstructionReference").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<decimal>("GeographicFactor").HasColumnType("numeric");
            e.Property<int>("Health").HasColumnType("integer");
            e.Property<int>("Hardship").HasColumnType("integer");
            e.Property<int>("Age").HasColumnType("integer");
            e.Property<int>("Size").HasColumnType("integer");
            e.Property<int>("Care").HasColumnType("integer");
            e.Property<int>("Education").HasColumnType("integer");
            e.Property<long>("AllocatedRial").HasColumnType("bigint");
            e.Property<DateTimeOffset>("AssessedAtUtc").HasColumnType("timestamp with time zone");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("FormulaVersion", "RuntimeProposalId", "RuntimeProfileSequence");
            e.HasIndex("HouseholdKey", "AssessedAtUtc");
            e.HasIndex("RuntimeProposalId");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("RuntimeProposalId")
                .OnDelete(DeleteBehavior.Restrict);
            e.ToTable("assessments", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_assessment_scores", "\"Health\" BETWEEN 0 AND 3 AND \"Hardship\" BETWEEN 0 AND 3 AND \"Age\" BETWEEN 0 AND 3 AND \"Size\" BETWEEN 0 AND 3 AND \"Care\" BETWEEN 0 AND 3 AND \"Education\" BETWEEN 0 AND 3");
                t.HasCheckConstraint("ck_assessment_provenance", "(\"RecordedByAccountId\" IS NULL AND \"EvidenceReference\" IS NULL) OR (\"RecordedByAccountId\" IS NOT NULL AND \"RecordedByAccountId\" <> '00000000-0000-0000-0000-000000000000'::uuid AND \"EvidenceReference\" IS NOT NULL AND length(btrim(\"EvidenceReference\")) > 0)");
                t.HasCheckConstraint("ck_assessment_amount", "\"AllocatedRial\" >= 0 AND \"GeographicFactor\" > 0");
                t.HasCheckConstraint("ck_assessment_runtime_sequence", "\"RuntimeProfileSequence\" IS NULL OR \"RuntimeProfileSequence\" >= 0");
            });
        });
        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationOutcomeRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("SnapshotId").HasColumnType("uuid");
            e.Property<DateTimeOffset>("PeriodStartUtc").HasColumnType("timestamp with time zone");
            e.Property<DateTimeOffset>("PeriodEndUtc").HasColumnType("timestamp with time zone");
            e.Property<decimal?>("CreditUsedRial").HasColumnType("numeric");
            e.Property<decimal?>("EssentialNeedsCoverage").HasColumnType("numeric");
            e.Property<bool?>("StockBarrier").HasColumnType("boolean");
            e.Property<bool?>("DeliveryBarrier").HasColumnType("boolean");
            e.Property<bool?>("AccessBarrier").HasColumnType("boolean");
            e.Property<int>("Evidence").HasColumnType("integer");
            e.Property<Guid?>("ReviewedByAccountId").HasColumnType("uuid");
            e.Property<string>("EvidenceReference").HasMaxLength(240).HasColumnType("character varying(240)");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("SnapshotId", "PeriodEndUtc");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationAssessmentRecord", null)
                .WithMany().HasForeignKey("SnapshotId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("outcomes", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_outcome_interval", "\"PeriodEndUtc\" > \"PeriodStartUtc\"");
                t.HasCheckConstraint("ck_outcome_values", "(\"CreditUsedRial\" IS NULL OR (\"CreditUsedRial\" >= 0 AND \"CreditUsedRial\" = trunc(\"CreditUsedRial\"))) AND (\"EssentialNeedsCoverage\" IS NULL OR \"EssentialNeedsCoverage\" BETWEEN 0 AND 1) AND \"Evidence\" BETWEEN 1 AND 3");
                t.HasCheckConstraint("ck_outcome_observed", "\"CreditUsedRial\" IS NOT NULL OR \"EssentialNeedsCoverage\" IS NOT NULL OR \"StockBarrier\" IS NOT NULL OR \"DeliveryBarrier\" IS NOT NULL OR \"AccessBarrier\" IS NOT NULL");
                t.HasCheckConstraint("ck_outcome_review_provenance", "(\"Evidence\" = 3 AND \"ReviewedByAccountId\" IS NOT NULL AND \"ReviewedByAccountId\" <> '00000000-0000-0000-0000-000000000000'::uuid AND \"EvidenceReference\" IS NOT NULL AND length(btrim(\"EvidenceReference\")) > 0) OR (\"Evidence\" <> 3 AND \"ReviewedByAccountId\" IS NULL AND \"EvidenceReference\" IS NULL)");
                t.HasCheckConstraint("ck_outcome_reviewed_nonfinancial", "\"Evidence\" <> 3 OR \"CreditUsedRial\" IS NULL");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("CreatedByAccountId").HasColumnType("uuid");
            e.Property<string>("CandidateVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("ModelVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("BaselineVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("DatasetVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("SourceInstructionReference").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("Rationale").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<long>("PoolRial").HasColumnType("bigint");
            e.Property<string>("WeightsJson").IsRequired().HasColumnType("jsonb");
            e.Property<string>("SnapshotIdsJson").IsRequired().HasColumnType("jsonb");
            e.Property<string>("SimulationJson").IsRequired().HasColumnType("jsonb");
            e.Property<DateTimeOffset>("CreatedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("CandidateVersion").IsUnique();
            e.HasIndex("CreatedAtUtc", "Id");
            e.ToTable("proposals", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_proposal_pool", "\"PoolRial\" > 0");
            });
        });
        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationProposalReviewRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("ProposalId").HasColumnType("uuid");
            e.Property<Guid>("ReviewerAccountId").HasColumnType("uuid");
            e.Property<string>("Decision").IsRequired().HasMaxLength(16).HasColumnType("character varying(16)");
            e.Property<string>("Reason").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<DateTimeOffset>("ReviewedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("ProposalId").IsUnique();
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("ProposalId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("reviews", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_review_decision", "\"Decision\" IN ('APPROVED', 'REJECTED')");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationPilotEventRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("ProposalId").HasColumnType("uuid");
            e.Property<Guid>("ActorAccountId").HasColumnType("uuid");
            e.Property<string>("EventType").IsRequired().HasMaxLength(24).HasColumnType("character varying(24)");
            e.Property<string>("ScopeReference").HasMaxLength(240).HasColumnType("character varying(240)");
            e.Property<string>("Reason").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("ProposalId", "RecordedAtUtc", "Id");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" = 'PILOT_AUTHORIZED'")
                .HasDatabaseName("UX_pilot_events_authorized");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" IN ('PILOT_COMPLETED','PILOT_ABORTED')")
                .HasDatabaseName("UX_pilot_events_terminal");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("ProposalId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("pilot_events", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_pilot_event_type", "\"EventType\" IN ('PILOT_AUTHORIZED','PILOT_COMPLETED','PILOT_ABORTED')");
                t.HasCheckConstraint("ck_pilot_event_scope", "(\"EventType\" = 'PILOT_AUTHORIZED' AND \"ScopeReference\" IS NOT NULL AND length(btrim(\"ScopeReference\")) > 0) OR (\"EventType\" IN ('PILOT_COMPLETED','PILOT_ABORTED') AND \"ScopeReference\" IS NULL)");
                t.HasCheckConstraint("ck_pilot_event_reason", "length(btrim(\"Reason\")) > 0");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationProductionControlEventRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("ProposalId").HasColumnType("uuid");
            e.Property<Guid>("ActorAccountId").HasColumnType("uuid");
            e.Property<string>("EventType").IsRequired().HasMaxLength(40).HasColumnType("character varying(40)");
            e.Property<string>("Reason").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("ProposalId", "RecordedAtUtc", "Id");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" = 'PRODUCTION_ACTIVATION_AUTHORIZED'")
                .HasDatabaseName("UX_production_control_activation");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" = 'PRODUCTION_ROLLBACK_AUTHORIZED'")
                .HasDatabaseName("UX_production_control_rollback");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("ProposalId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("production_control_events", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_production_control_event_type", "\"EventType\" IN ('PRODUCTION_ACTIVATION_AUTHORIZED','PRODUCTION_ROLLBACK_AUTHORIZED')");
                t.HasCheckConstraint("ck_production_control_reason", "length(btrim(\"Reason\")) > 0");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationRuntimeProfileEventRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("ProposalId").HasColumnType("uuid");
            e.Property<Guid>("ActorAccountId").HasColumnType("uuid");
            e.Property<long>("Sequence").HasColumnType("bigint");
            e.Property<string>("EventType").IsRequired().HasMaxLength(32).HasColumnType("character varying(32)");
            e.Property<Guid?>("EffectiveProposalId").HasColumnType("uuid");
            e.Property<string>("EffectiveProfileVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("EffectiveWeightsJson").IsRequired().HasColumnType("jsonb");
            e.Property<Guid?>("PreviousProposalId").HasColumnType("uuid");
            e.Property<string>("PreviousProfileVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("PreviousWeightsJson").IsRequired().HasColumnType("jsonb");
            e.Property<string>("Reason").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("Sequence").IsUnique()
                .HasDatabaseName("UX_runtime_profile_sequence");
            e.HasIndex("RecordedAtUtc", "Id");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" = 'RUNTIME_PROMOTED'")
                .HasDatabaseName("UX_runtime_profile_promoted");
            e.HasIndex("ProposalId").IsUnique()
                .HasFilter("\"EventType\" = 'RUNTIME_ROLLED_BACK'")
                .HasDatabaseName("UX_runtime_profile_rolled_back");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("ProposalId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("runtime_profile_events", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_runtime_profile_event_type", "\"EventType\" IN ('RUNTIME_PROMOTED','RUNTIME_ROLLED_BACK')");
                t.HasCheckConstraint("ck_runtime_profile_versions", "length(btrim(\"EffectiveProfileVersion\")) > 0 AND length(btrim(\"PreviousProfileVersion\")) > 0");
                t.HasCheckConstraint("ck_runtime_profile_reason", "length(btrim(\"Reason\")) > 0");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationRetentionEventRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("ActorAccountId").HasColumnType("uuid");
            e.Property<string>("Scope").IsRequired().HasMaxLength(40).HasColumnType("character varying(40)");
            e.Property<DateTimeOffset>("CutoffUtc").HasColumnType("timestamp with time zone");
            e.Property<string>("PreviewDigest").IsRequired().HasMaxLength(64).HasColumnType("character varying(64)");
            e.Property<int>("DeletedSnapshotCount").HasColumnType("integer");
            e.Property<int>("DeletedOutcomeCount").HasColumnType("integer");
            e.Property<string>("Reason").IsRequired().HasMaxLength(2000).HasColumnType("character varying(2000)");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("RecordedAtUtc", "Id");
            e.HasIndex("CutoffUtc", "Id");
            e.ToTable("retention_events", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_retention_scope", "\"Scope\" = 'ATTRIBUTED_RESEARCH'");
                t.HasCheckConstraint("ck_retention_counts", "\"DeletedSnapshotCount\" > 0 AND \"DeletedOutcomeCount\" >= 0");
                t.HasCheckConstraint("ck_retention_reason", "length(btrim(\"Reason\")) > 0");
                t.HasCheckConstraint("ck_retention_digest", "length(\"PreviewDigest\") = 64");
            });
        });

        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.ReviewedNeedLabelRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("SnapshotId").HasColumnType("uuid");
            e.Property<Guid>("ReviewerAccountId").HasColumnType("uuid");
            e.Property<decimal>("NeedScore").HasColumnType("numeric");
            e.Property<string>("RubricVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<int>("Partition").HasColumnType("integer");
            e.Property<DateTimeOffset>("ReviewedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("SnapshotId", "RubricVersion").IsUnique();
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationAssessmentRecord", null)
                .WithMany().HasForeignKey("SnapshotId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            e.ToTable("need_labels", "allocation_learning", t =>
                t.HasCheckConstraint("ck_need_label", "\"NeedScore\" BETWEEN 0 AND 1 AND \"Partition\" IN (1, 2, 3)"));
        });
        modelBuilder.Entity("Hana.Infrastructure.CreditLearning.AllocationTrainingRunRecord", e =>
        {
            e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");
            e.Property<Guid>("RequestedByAccountId").HasColumnType("uuid");
            e.Property<Guid?>("ProposalId").HasColumnType("uuid");
            e.Property<string>("Status").IsRequired().HasMaxLength(24).HasColumnType("character varying(24)");
            e.Property<string>("DatasetVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("ModelVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            e.Property<string>("InputsJson").IsRequired().HasColumnType("jsonb");
            e.Property<string?>("MetricsJson").HasColumnType("jsonb");
            e.Property<DateTimeOffset>("CutoffUtc").HasColumnType("timestamp with time zone");
            e.Property<DateTimeOffset>("RecordedAtUtc").HasColumnType("timestamp with time zone");
            e.HasKey("Id");
            e.HasIndex("ProposalId").IsUnique();
            e.HasIndex("RecordedAtUtc", "Id");
            e.HasOne("Hana.Infrastructure.CreditLearning.AllocationProposalRecord", null)
                .WithMany().HasForeignKey("ProposalId").OnDelete(DeleteBehavior.Restrict);
            e.ToTable("training_runs", "allocation_learning", t =>
                t.HasCheckConstraint("ck_training_run", "(\"Status\" = 'PROPOSED' AND \"ProposalId\" IS NOT NULL AND \"MetricsJson\" IS NOT NULL) OR (\"Status\" = 'NO_IMPROVEMENT' AND \"ProposalId\" IS NULL)"));
        });
    }
}
