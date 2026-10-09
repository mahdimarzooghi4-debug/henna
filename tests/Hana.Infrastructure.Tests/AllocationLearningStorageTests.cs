using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationLearningStorageTests
{
    [Fact]
    public void MigrationSnapshotMatchesModel()
    {
        using var db = CreateContext("Host=localhost;Database=learning_model_check");
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var previous = db.GetService<IModelRuntimeInitializer>().Initialize(snapshot.Model, designTime: true);
        Assert.Empty(db.GetService<IMigrationsModelDiffer>().GetDifferences(
            previous.GetRelationalModel(), current.GetRelationalModel()));
    }

    [Fact]
    public async Task PostgreSqlPersistsSnapshotsAndOutcomesAndPreventsRewriting()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        await using var db = CreateContext(connection);
        await db.Database.MigrateAsync();
        await db.Database.MigrateAsync();
        var now = new DateTimeOffset(2026, 10, 4, 0, 0, 0, TimeSpan.Zero);
        var writer = new AllocationLearningRecorder(db, new FixedClock(now));
        var snapshotId = Guid.NewGuid();
        await writer.RecordAssessmentAsync(snapshotId,
            new(Guid.NewGuid(), new(1, 2, 0, 1, 0, 1), 1m),
            "formula-1", "dataset-1", "source-1", 1000, now.AddDays(-3));
        var eventId = Guid.NewGuid();
        await writer.RecordOutcomeAsync(new(eventId, snapshotId, now.AddDays(-2), now.AddDays(-1),
            null, null, null, true, null, AllocationOutcomeEvidence.HouseholdReported));
        db.ChangeTracker.Clear();
        var stored = await db.Outcomes.SingleAsync(x => x.Id == eventId);
        Assert.Null(stored.CreditUsedRial);
        Assert.True(stored.DeliveryBarrier);
        stored.CreditUsedRial = 0;
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear();
        db.Outcomes.Remove(await db.Outcomes.SingleAsync(x => x.Id == eventId));
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<ArgumentException>(() => writer.RecordOutcomeAsync(new(
            Guid.NewGuid(), snapshotId, now.AddDays(-4), now.AddDays(-1),
            0m, null, null, null, null, AllocationOutcomeEvidence.Administrative)));
        await Assert.ThrowsAsync<DbUpdateException>(() => writer.RecordOutcomeAsync(new(
            eventId, snapshotId, now.AddDays(-2), now.AddDays(-1),
            0m, null, null, null, null, AllocationOutcomeEvidence.Administrative)));
    }

    [Fact]
    public async Task AttributedAssessmentReplayIsIdempotentButDivergentReuseConflicts()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        await using var db = CreateContext(connection);
        await db.Database.MigrateAsync();

        var now = new DateTimeOffset(2026, 10, 6, 8, 0, 0, TimeSpan.Zero);
        var writer = new AllocationLearningRecorder(db, new FixedClock(now));
        var snapshotId = Guid.NewGuid();
        var household = Guid.NewGuid();
        var reviewer = Guid.NewGuid();
        var assessment = new AllocationLearningCase(
            household, new(1, 2, 0, 1, 0, 3), 1.1m);

        Assert.True(await writer.RecordAssessmentIdempotentlyAsync(
            snapshotId, assessment, AllocationWeightProfile.Baseline.Version,
            "research-dataset", "research-source", 700,
            now.AddMinutes(-5), recordedByAccountId: reviewer,
            evidenceReference: "evidence-ref"));

        Assert.False(await writer.RecordAssessmentIdempotentlyAsync(
            snapshotId, assessment, AllocationWeightProfile.Baseline.Version,
            "research-dataset", "research-source", 700,
            now.AddMinutes(-5), recordedByAccountId: reviewer,
            evidenceReference: "evidence-ref"));

        Assert.Single(await db.Assessments.AsNoTracking()
            .Where(x => x.Id == snapshotId).ToListAsync());

        await Assert.ThrowsAsync<AllocationAssessmentIdempotencyConflictException>(
            () => writer.RecordAssessmentIdempotentlyAsync(
                snapshotId, assessment, AllocationWeightProfile.Baseline.Version,
                "research-dataset", "research-source", 701,
                now.AddMinutes(-5), recordedByAccountId: reviewer,
                evidenceReference: "evidence-ref"));
    }

    private static HanaAllocationLearningDbContext CreateContext(string connection) => new(
        new DbContextOptionsBuilder<HanaAllocationLearningDbContext>().UseNpgsql(connection,
            pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "allocation_learning")).Options);

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow => now;
    }
}
