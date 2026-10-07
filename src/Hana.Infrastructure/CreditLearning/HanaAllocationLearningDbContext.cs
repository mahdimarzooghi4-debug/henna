using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationAssessmentRecord
{
    public Guid Id { get; set; }
    public Guid HouseholdKey { get; set; }
    public Guid? RecordedByAccountId { get; set; }
    public string? EvidenceReference { get; set; }
    public string FormulaVersion { get; set; } = "";
    public Guid? RuntimeProposalId { get; set; }
    public long? RuntimeProfileSequence { get; set; }
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
    public Guid? ReviewedByAccountId { get; set; }
    public string? EvidenceReference { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

/// <summary>Internal research storage. Normal writes are append-only; the explicit privileged retention service may purge only its audited research scope.</summary>
public sealed class HanaAllocationLearningDbContext(DbContextOptions<HanaAllocationLearningDbContext> options)
    : DbContext(options)
{
    public DbSet<AllocationAssessmentRecord> Assessments => Set<AllocationAssessmentRecord>();
    public DbSet<AllocationOutcomeRecord> Outcomes => Set<AllocationOutcomeRecord>();
    public DbSet<AllocationProposalRecord> Proposals => Set<AllocationProposalRecord>();
    public DbSet<AllocationProposalReviewRecord> Reviews => Set<AllocationProposalReviewRecord>();
    public DbSet<ReviewedNeedLabelRecord> NeedLabels => Set<ReviewedNeedLabelRecord>();
    public DbSet<AllocationTrainingRunRecord> TrainingRuns => Set<AllocationTrainingRunRecord>();
    public DbSet<AllocationPilotEventRecord> PilotEvents => Set<AllocationPilotEventRecord>();
    public DbSet<AllocationProductionControlEventRecord> ProductionControlEvents =>
        Set<AllocationProductionControlEventRecord>();
    public DbSet<AllocationRuntimeProfileEventRecord> RuntimeProfileEvents =>
        Set<AllocationRuntimeProfileEventRecord>();
    public DbSet<AllocationRetentionEventRecord> RetentionEvents =>
        Set<AllocationRetentionEventRecord>();
    public DbSet<AllocationModelBenchmarkRecord> ModelBenchmarks =>
        Set<AllocationModelBenchmarkRecord>();
    public DbSet<AllocationShadowModelBenchmarkRecord> ShadowModelBenchmarks =>
        Set<AllocationShadowModelBenchmarkRecord>();
    public DbSet<AllocationEbmArtifactRecord> EbmArtifacts =>
        Set<AllocationEbmArtifactRecord>();
    public DbSet<AllocationEbmBenchmarkRecord> EbmModelBenchmarks =>
        Set<AllocationEbmBenchmarkRecord>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema("allocation_learning");
        model.Entity<AllocationAssessmentRecord>(e =>
        {
            e.ToTable("assessments", t =>
            {
                t.HasCheckConstraint("ck_assessment_scores", "\"Health\" BETWEEN 0 AND 3 AND \"Hardship\" BETWEEN 0 AND 3 AND \"Age\" BETWEEN 0 AND 3 AND \"Size\" BETWEEN 0 AND 3 AND \"Care\" BETWEEN 0 AND 3 AND \"Education\" BETWEEN 0 AND 3");
                t.HasCheckConstraint("ck_assessment_provenance", "(\"RecordedByAccountId\" IS NULL AND \"EvidenceReference\" IS NULL) OR (\"RecordedByAccountId\" IS NOT NULL AND \"RecordedByAccountId\" <> '00000000-0000-0000-0000-000000000000'::uuid AND \"EvidenceReference\" IS NOT NULL AND length(btrim(\"EvidenceReference\")) > 0)");
                t.HasCheckConstraint("ck_assessment_amount", "\"AllocatedRial\" >= 0 AND \"GeographicFactor\" > 0");
                t.HasCheckConstraint("ck_assessment_runtime_sequence",
                    "\"RuntimeProfileSequence\" IS NULL OR \"RuntimeProfileSequence\" >= 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.EvidenceReference).HasMaxLength(240);
            e.Property(x => x.FormulaVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.GeographicFactor).HasColumnType("numeric");
            e.HasIndex(x => new { x.HouseholdKey, x.AssessedAtUtc });
            e.HasIndex(x => new { x.FormulaVersion, x.RuntimeProposalId, x.RuntimeProfileSequence });
            e.HasIndex(x => x.RuntimeProposalId);
            e.HasOne<AllocationProposalRecord>().WithMany()
                .HasForeignKey(x => x.RuntimeProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationOutcomeRecord>(e =>
        {
            e.ToTable("outcomes", t =>
            {
                t.HasCheckConstraint("ck_outcome_interval", "\"PeriodEndUtc\" > \"PeriodStartUtc\"");
                t.HasCheckConstraint("ck_outcome_values", "(\"CreditUsedRial\" IS NULL OR (\"CreditUsedRial\" >= 0 AND \"CreditUsedRial\" = trunc(\"CreditUsedRial\"))) AND (\"EssentialNeedsCoverage\" IS NULL OR \"EssentialNeedsCoverage\" BETWEEN 0 AND 1) AND \"Evidence\" BETWEEN 1 AND 3");
                t.HasCheckConstraint("ck_outcome_observed", "\"CreditUsedRial\" IS NOT NULL OR \"EssentialNeedsCoverage\" IS NOT NULL OR \"StockBarrier\" IS NOT NULL OR \"DeliveryBarrier\" IS NOT NULL OR \"AccessBarrier\" IS NOT NULL");
                t.HasCheckConstraint("ck_outcome_review_provenance",
                    "(\"Evidence\" = 3 AND \"ReviewedByAccountId\" IS NOT NULL AND \"ReviewedByAccountId\" <> '00000000-0000-0000-0000-000000000000'::uuid AND \"EvidenceReference\" IS NOT NULL AND length(btrim(\"EvidenceReference\")) > 0) OR (\"Evidence\" <> 3 AND \"ReviewedByAccountId\" IS NULL AND \"EvidenceReference\" IS NULL)");
                t.HasCheckConstraint("ck_outcome_reviewed_nonfinancial",
                    "\"Evidence\" <> 3 OR \"CreditUsedRial\" IS NULL");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.CreditUsedRial).HasColumnType("numeric");
            e.Property(x => x.EssentialNeedsCoverage).HasColumnType("numeric");
            e.Property(x => x.EvidenceReference).HasMaxLength(240);
            e.HasOne<AllocationAssessmentRecord>().WithMany().HasForeignKey(x => x.SnapshotId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SnapshotId, x.PeriodEndUtc });
        });
        model.Entity<AllocationProposalRecord>(e =>
        {
            e.ToTable("proposals", t => t.HasCheckConstraint("ck_proposal_pool", "\"PoolRial\" > 0"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.CandidateVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.Rationale).HasMaxLength(2000).IsRequired();
            e.Property(x => x.BaselineVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.WeightsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.SnapshotIdsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.SimulationJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => x.CandidateVersion).IsUnique();
            e.HasIndex(x => new { x.CreatedAtUtc, x.Id });
        });
        model.Entity<AllocationProposalReviewRecord>(e =>
        {
            e.ToTable("reviews", t => t.HasCheckConstraint("ck_review_decision", "\"Decision\" IN ('APPROVED', 'REJECTED')"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Decision).HasMaxLength(16).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => x.ProposalId).IsUnique();
            e.HasOne<AllocationProposalRecord>().WithMany().HasForeignKey(x => x.ProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<ReviewedNeedLabelRecord>(e =>
        {
            e.ToTable("need_labels", t => t.HasCheckConstraint("ck_need_label",
                "\"NeedScore\" BETWEEN 0 AND 1 AND \"Partition\" IN (1, 2, 3)"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.NeedScore).HasColumnType("numeric");
            e.Property(x => x.RubricVersion).HasMaxLength(120).IsRequired();
            e.HasIndex(x => new { x.SnapshotId, x.RubricVersion }).IsUnique();
            e.HasOne<AllocationAssessmentRecord>().WithMany().HasForeignKey(x => x.SnapshotId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationTrainingRunRecord>(e =>
        {
            e.ToTable("training_runs", t =>
            {
                t.HasCheckConstraint("ck_training_run",
                    "(\"Status\" = 'PROPOSED' AND \"ProposalId\" IS NOT NULL AND \"MetricsJson\" IS NOT NULL) OR (\"Status\" = 'NO_IMPROVEMENT' AND \"ProposalId\" IS NULL)");
                t.HasCheckConstraint("ck_training_run_shadow_artifact",
                    "((\"ShadowModelVersion\" IS NULL AND \"ShadowArtifactFormat\" IS NULL AND \"ShadowArtifactSha256\" IS NULL AND \"ShadowArtifactBytes\" IS NULL AND \"ShadowParametersJson\" IS NULL AND \"ShadowMetricsJson\" IS NULL) OR (\"ShadowModelVersion\" IS NOT NULL AND \"ShadowArtifactFormat\" IS NOT NULL AND \"ShadowArtifactSha256\" IS NOT NULL AND length(\"ShadowArtifactSha256\") = 64 AND \"ShadowArtifactBytes\" IS NOT NULL AND octet_length(\"ShadowArtifactBytes\") > 0 AND \"ShadowParametersJson\" IS NOT NULL AND \"ShadowMetricsJson\" IS NOT NULL))");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Status).HasMaxLength(24).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.InputsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.MetricsJson).HasColumnType("jsonb");
            e.Property(x => x.ShadowModelVersion).HasMaxLength(120);
            e.Property(x => x.ShadowArtifactFormat).HasMaxLength(40);
            e.Property(x => x.ShadowArtifactSha256).HasMaxLength(64);
            e.Property(x => x.ShadowArtifactBytes).HasColumnType("bytea");
            e.Property(x => x.ShadowParametersJson).HasColumnType("jsonb");
            e.Property(x => x.ShadowMetricsJson).HasColumnType("jsonb");
            e.HasIndex(x => new { x.RecordedAtUtc, x.Id });
            e.HasIndex(x => x.ProposalId).IsUnique();
            e.HasOne<AllocationProposalRecord>().WithMany().HasForeignKey(x => x.ProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationPilotEventRecord>(e =>
        {
            e.ToTable("pilot_events", t =>
            {
                t.HasCheckConstraint("ck_pilot_event_type",
                    "\"EventType\" IN ('PILOT_AUTHORIZED','PILOT_COMPLETED','PILOT_ABORTED')");
                t.HasCheckConstraint("ck_pilot_event_scope",
                    "(\"EventType\" = 'PILOT_AUTHORIZED' AND \"ScopeReference\" IS NOT NULL AND length(btrim(\"ScopeReference\")) > 0) OR (\"EventType\" IN ('PILOT_COMPLETED','PILOT_ABORTED') AND \"ScopeReference\" IS NULL)");
                t.HasCheckConstraint("ck_pilot_event_reason",
                    "length(btrim(\"Reason\")) > 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.EventType).HasMaxLength(24).IsRequired();
            e.Property(x => x.ScopeReference).HasMaxLength(240);
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.ProposalId, x.RecordedAtUtc, x.Id });
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" = 'PILOT_AUTHORIZED'")
                .HasDatabaseName("UX_pilot_events_authorized");
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" IN ('PILOT_COMPLETED','PILOT_ABORTED')")
                .HasDatabaseName("UX_pilot_events_terminal");
            e.HasOne<AllocationProposalRecord>().WithMany().HasForeignKey(x => x.ProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationProductionControlEventRecord>(e =>
        {
            e.ToTable("production_control_events", t =>
            {
                t.HasCheckConstraint("ck_production_control_event_type",
                    "\"EventType\" IN ('PRODUCTION_ACTIVATION_AUTHORIZED','PRODUCTION_ROLLBACK_AUTHORIZED')");
                t.HasCheckConstraint("ck_production_control_reason",
                    "length(btrim(\"Reason\")) > 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.EventType).HasMaxLength(40).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.ProposalId, x.RecordedAtUtc, x.Id });
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" = 'PRODUCTION_ACTIVATION_AUTHORIZED'")
                .HasDatabaseName("UX_production_control_activation");
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" = 'PRODUCTION_ROLLBACK_AUTHORIZED'")
                .HasDatabaseName("UX_production_control_rollback");
            e.HasOne<AllocationProposalRecord>().WithMany().HasForeignKey(x => x.ProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationRuntimeProfileEventRecord>(e =>
        {
            e.ToTable("runtime_profile_events", t =>
            {
                t.HasCheckConstraint("ck_runtime_profile_event_type",
                    "\"EventType\" IN ('RUNTIME_PROMOTED','RUNTIME_ROLLED_BACK')");
                t.HasCheckConstraint("ck_runtime_profile_versions",
                    "length(btrim(\"EffectiveProfileVersion\")) > 0 AND length(btrim(\"PreviousProfileVersion\")) > 0");
                t.HasCheckConstraint("ck_runtime_profile_reason",
                    "length(btrim(\"Reason\")) > 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Sequence).IsRequired();
            e.Property(x => x.EventType).HasMaxLength(32).IsRequired();
            e.Property(x => x.EffectiveProfileVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.EffectiveWeightsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.PreviousProfileVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.PreviousWeightsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => x.Sequence).IsUnique()
                .HasDatabaseName("UX_runtime_profile_sequence");
            e.HasIndex(x => new { x.RecordedAtUtc, x.Id });
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" = 'RUNTIME_PROMOTED'")
                .HasDatabaseName("UX_runtime_profile_promoted");
            e.HasIndex(x => x.ProposalId).IsUnique()
                .HasFilter("\"EventType\" = 'RUNTIME_ROLLED_BACK'")
                .HasDatabaseName("UX_runtime_profile_rolled_back");
            e.HasOne<AllocationProposalRecord>().WithMany().HasForeignKey(x => x.ProposalId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationRetentionEventRecord>(e =>
        {
            e.ToTable("retention_events", t =>
            {
                t.HasCheckConstraint("ck_retention_scope",
                    "\"Scope\" = 'ATTRIBUTED_RESEARCH'");
                t.HasCheckConstraint("ck_retention_counts",
                    "\"DeletedSnapshotCount\" > 0 AND \"DeletedOutcomeCount\" >= 0");
                t.HasCheckConstraint("ck_retention_reason",
                    "length(btrim(\"Reason\")) > 0");
                t.HasCheckConstraint("ck_retention_digest",
                    "length(\"PreviewDigest\") = 64");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Scope).HasMaxLength(40).IsRequired();
            e.Property(x => x.PreviewDigest).HasMaxLength(64).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.RecordedAtUtc, x.Id });
            e.HasIndex(x => new { x.CutoffUtc, x.Id });
        });
        model.Entity<AllocationModelBenchmarkRecord>(e =>
        {
            e.ToTable("model_benchmarks", t =>
            {
                t.HasCheckConstraint("ck_model_benchmark_fingerprint",
                    "length(\"EvaluationFingerprint\") = 64");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ProtocolVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.BaselineVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.CandidateVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.EvaluationLabelIdsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.EvaluationFingerprint).HasMaxLength(64).IsRequired();
            e.Property(x => x.MetricsJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => new { x.EvaluationFingerprint, x.RecordedAtUtc, x.Id });
            e.HasIndex(x => new { x.ProposalId, x.EvaluationFingerprint }).IsUnique();
            e.HasOne<AllocationProposalRecord>().WithMany()
                .HasForeignKey(x => x.ProposalId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<AllocationProposalRecord>().WithMany()
                .HasForeignKey(x => x.RuntimeProposalId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationShadowModelBenchmarkRecord>(e =>
        {
            e.ToTable("shadow_model_benchmarks", t =>
            {
                t.HasCheckConstraint(
                    "ck_shadow_model_benchmark_fingerprint",
                    "length(\"EvaluationFingerprint\") = 64 AND length(\"ArtifactSha256\") = 64");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ProtocolVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ArtifactSha256).HasMaxLength(64).IsRequired();
            e.Property(x => x.BaselineVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.EvaluationLabelIdsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.EvaluationFingerprint).HasMaxLength(64).IsRequired();
            e.Property(x => x.MetricsJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => new { x.EvaluationFingerprint, x.RecordedAtUtc, x.Id });
            e.HasIndex(x => new { x.TrainingRunId, x.EvaluationFingerprint }).IsUnique();
            e.HasOne<AllocationTrainingRunRecord>().WithMany()
                .HasForeignKey(x => x.TrainingRunId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<AllocationProposalRecord>().WithMany()
                .HasForeignKey(x => x.RuntimeProposalId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationEbmArtifactRecord>(e =>
        {
            e.ToTable("ebm_artifacts", t =>
            {
                t.HasCheckConstraint(
                    "ck_ebm_artifact",
                    "\"ModelVersion\" = 'henna-ebm-v1-offline' AND \"ArtifactFormat\" = 'henna-ebm-portable-json-v1' AND \"LibraryName\" = 'interpret-core' AND \"LibraryVersion\" = '0.7.8' AND length(\"ArtifactSha256\") = 64 AND octet_length(\"ArtifactBytes\") > 0");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ArtifactFormat).HasMaxLength(80).IsRequired();
            e.Property(x => x.ArtifactSha256).HasMaxLength(64).IsRequired();
            e.Property(x => x.ArtifactBytes).HasColumnType("bytea").IsRequired();
            e.Property(x => x.LibraryName).HasMaxLength(80).IsRequired();
            e.Property(x => x.LibraryVersion).HasMaxLength(40).IsRequired();
            e.Property(x => x.ReportJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => x.TrainingRunId).IsUnique();
            e.HasIndex(x => new { x.RecordedAtUtc, x.Id });
            e.HasOne<AllocationTrainingRunRecord>().WithMany()
                .HasForeignKey(x => x.TrainingRunId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AllocationEbmBenchmarkRecord>(e =>
        {
            e.ToTable("ebm_model_benchmarks", t =>
            {
                t.HasCheckConstraint(
                    "ck_ebm_model_benchmark",
                    "length(\"EvaluationFingerprint\") = 64 AND length(\"ArtifactSha256\") = 64");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ProtocolVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ModelVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.ArtifactSha256).HasMaxLength(64).IsRequired();
            e.Property(x => x.BaselineVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.DatasetVersion).HasMaxLength(120).IsRequired();
            e.Property(x => x.SourceInstructionReference).HasMaxLength(120).IsRequired();
            e.Property(x => x.EvaluationLabelIdsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.EvaluationFingerprint).HasMaxLength(64).IsRequired();
            e.Property(x => x.MetricsJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => new { x.EvaluationFingerprint, x.RecordedAtUtc, x.Id });
            e.HasIndex(x => new { x.EbmArtifactId, x.EvaluationFingerprint }).IsUnique();
            e.HasIndex(x => x.TrainingRunId);
            e.HasOne<AllocationEbmArtifactRecord>().WithMany()
                .HasForeignKey(x => x.EbmArtifactId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<AllocationTrainingRunRecord>().WithMany()
                .HasForeignKey(x => x.TrainingRunId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<AllocationProposalRecord>().WithMany()
                .HasForeignKey(x => x.RuntimeProposalId).OnDelete(DeleteBehavior.Restrict);
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
