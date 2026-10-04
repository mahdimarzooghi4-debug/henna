using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationAssessmentRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdKey { get; set; }
    public string FormulaVersion { get; set; } = "";
    public string DatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public decimal GeographicFactor { get; set; }
    public int Health { get; set; }
    public int Hardship { get; set; }
    public int Age { get; set; }
    public int Size { get; set; }
    public int Care { get; set; }
    public int Education { get; set; }
    public long AllocatedRial { get; set; }
    public DateTimeOffset AssessedAtUtc { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class AllocationOutcomeRecord
{
    public Guid Id { get; set; }
    public Guid SnapshotId { get; set; }
    public DateTimeOffset PeriodStartUtc { get; set; }
    public DateTimeOffset PeriodEndUtc { get; set; }
    public decimal? CreditUsedRial { get; set; }
    public decimal? EssentialNeedsCoverage { get; set; }
    public bool? StockBarrier { get; set; }
    public bool? DeliveryBarrier { get; set; }
    public bool? AccessBarrier { get; set; }
    public int Evidence { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

/// <summary>Internal research storage. Retention deletion requires a separate privileged procedure.</summary>
public sealed class HanaAllocationLearningDbContext(DbContextOptions<HanaAllocationLearningDbContext> options)
    : DbContext(options)
{
    public DbSet<AllocationAssessmentRecord> Assessments => Set<AllocationAssessmentRecord>();
    public DbSet<AllocationOutcomeRecord> Outcomes => Set<AllocationOutcomeRecord>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema("allocation_learning");
        model.Entity<AllocationAssessmentRecord>(e =>
        {
            e.ToTable("assessments", t =>
            {
                t.HasCheckConstraint("ck_assessment_scores", "\"Health\" BETWEEN 0 AND 3 AND \"Hardship\" BETWEEN 0 AND 3 AND \"Age\" BETWEEN 0 AND 3 AND \"Size\" BETWEEN 0 AND 3 AND \"Care\" BETWEEN 0 AND 3 AND \"Education\" BETWEEN 0 AND 3");
                t.HasCheckConstraint("ck_assessment_amount", "\"AllocatedRial\" >= 0 AND \"GeographicFactor\" > 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.FormulaVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.GeographicFactor).HasColumnType("numeric");
            e.HasIndex(x => new { x.HouseholdKey, x.AssessedAtUtc });
        });
        model.Entity<AllocationOutcomeRecord>(e =>
        {
            e.ToTable("outcomes", t =>
            {
                t.HasCheckConstraint("ck_outcome_interval", "\"PeriodEndUtc\" > \"PeriodStartUtc\"");
                t.HasCheckConstraint("ck_outcome_values", "(\"CreditUsedRial\" IS NULL OR (\"CreditUsedRial\" >= 0 AND \"CreditUsedRial\" = trunc(\"CreditUsedRial\"))) AND (\"EssentialNeedsCoverage\" IS NULL OR \"EssentialNeedsCoverage\" BETWEEN 0 AND 1) AND \"Evidence\" BETWEEN 1 AND 3");
                t.HasCheckConstraint("ck_outcome_observed", "\"CreditUsedRial\" IS NOT NULL OR \"EssentialNeedsCoverage\" IS NOT NULL OR \"StockBarrier\" IS NOT NULL OR \"DeliveryBarrier\" IS NOT NULL OR \"AccessBarrier\" IS NOT NULL");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.CreditUsedRial).HasColumnType("numeric");
            e.Property(x => x.EssentialNeedsCoverage).HasColumnType("numeric");
            e.HasOne<AllocationAssessmentRecord>().WithMany().HasForeignKey(x => x.SnapshotId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SnapshotId, x.PeriodEndUtc });
        });
    }

    private void RequireAppendOnly()
    {
        ChangeTracker.DetectChanges();
        if (ChangeTracker.Entries().Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Research observations are append-only.");
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        RequireAppendOnly();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        RequireAppendOnly();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }
}
