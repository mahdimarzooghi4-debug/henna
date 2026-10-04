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
            e.Property<string>("FormulaVersion").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
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
            e.HasIndex("HouseholdKey", "AssessedAtUtc");
            e.ToTable("assessments", "allocation_learning", t =>
            {
                t.HasCheckConstraint("ck_assessment_scores", "\"Health\" BETWEEN 0 AND 3 AND \"Hardship\" BETWEEN 0 AND 3 AND \"Age\" BETWEEN 0 AND 3 AND \"Size\" BETWEEN 0 AND 3 AND \"Care\" BETWEEN 0 AND 3 AND \"Education\" BETWEEN 0 AND 3");
                t.HasCheckConstraint("ck_assessment_amount", "\"AllocatedRial\" >= 0 AND \"GeographicFactor\" > 0");
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
    }
}
