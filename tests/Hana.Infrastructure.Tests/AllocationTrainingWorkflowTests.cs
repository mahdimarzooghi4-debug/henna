using System.Security.Cryptography;
using System.Text.Json;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationTrainingWorkflowTests
{
    [Fact]
    public async Task ReviewedLabelsProduceAuditedPendingProposalAndNoImprovementProducesOnlyAudit()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options);
        await using var db = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>().UseNpgsql(connection,
                pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "allocation_learning")).Options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        var actor = Guid.NewGuid(); var reviewer = Guid.NewGuid(); var clock = new SystemClock();
        foreach (var id in new[] { actor, reviewer })
        {
            identity.Accounts.Add(new() { Id = id, NormalizedPhone = "09" +
                RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"), CreatedAtUtc = clock.UtcNow });
            identity.RoleAssignments.Add(new() { AccountId = id, Role = HanaRoles.Admin, GrantedAtUtc = clock.UtcNow });
        }
        await identity.SaveChangesAsync();
        var roles = new RoleAuthorizationService(identity, new AuthSessionService(identity, clock));
        var workflow = new AllocationTrainingWorkflow(db, roles, clock, new AllocationProposalService(db, clock));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => workflow.ReviewNeedAsync(
            Guid.NewGuid(), Guid.NewGuid(), .5m, "rubric", LearningPartition.Training));
        var dataset = "data-" + Guid.NewGuid(); var source = "source-" + Guid.NewGuid();
        var snapshotIds = Enumerable.Range(0, 48).Select(_ => Guid.NewGuid()).ToArray();
        var labels = new List<Guid>();
        for (var i = 0; i < snapshotIds.Length; i++)
        {
            var feature = i % 6;
            var scores = Enumerable.Range(0, 6).Select(k => k == feature ? 3 : 0).ToArray();
            db.Assessments.Add(new() { Id = snapshotIds[i], HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version, DatasetVersion = dataset,
                SourceInstructionReference = source, GeographicFactor = 1m, Health = scores[0],
                Hardship = scores[1], Age = scores[2], Size = scores[3], Care = scores[4], Education = scores[5],
                AllocatedRial = 100, AssessedAtUtc = clock.UtcNow.AddDays(-1), RecordedAtUtc = clock.UtcNow });
        }
        await db.SaveChangesAsync();
        for (var i = 0; i < snapshotIds.Length; i++) labels.Add(await workflow.ReviewNeedAsync(reviewer,
            snapshotIds[i], new[] { .35m, .20m, .18m, .12m, .10m, .05m }[i % 6], "synthetic-rubric-1",
            i < 36 ? LearningPartition.Training : LearningPartition.Validation));
        var run = await workflow.TrainAsync(actor, labels, 4800, clock.UtcNow);
        Assert.Equal("PROPOSED", run.Status);
        Assert.NotNull(run.ProposalId);
        Assert.NotNull(run.MetricsJson);
        var proposal = await db.Proposals.AsNoTracking().SingleAsync(x => x.Id == run.ProposalId);
        Assert.Equal(ExperimentalAllocationWeightLearner.ModelVersion, proposal.ModelVersion);
        Assert.False(await db.Reviews.AnyAsync(x => x.ProposalId == proposal.Id));
        using var frozen = JsonDocument.Parse(run.InputsJson);
        Assert.Equal("HENNA_OWNED_LOCAL", frozen.RootElement.GetProperty("engine").GetString());
        Assert.False(frozen.RootElement.GetProperty("networkModelApi").GetBoolean());
        Assert.Equal("HENNA_FIRST_PARTY", frozen.RootElement.GetProperty("dataOrigin").GetString());
        Assert.Equal(48, frozen.RootElement.GetProperty("examples").GetArrayLength());
        var baselineLabels = new List<Guid>();
        for (var i = 0; i < snapshotIds.Length; i++) baselineLabels.Add(await workflow.ReviewNeedAsync(reviewer,
            snapshotIds[i], new[] { .30m, .25m, .18m, .12m, .10m, .05m }[i % 6], "synthetic-rubric-2",
            i < 36 ? LearningPartition.Training : LearningPartition.Validation));
        var rejected = await workflow.TrainAsync(actor, baselineLabels, 4800, clock.UtcNow);
        Assert.Equal("NO_IMPROVEMENT", rejected.Status);
        Assert.Null(rejected.ProposalId);
        Assert.Equal(2, await db.TrainingRuns.CountAsync(x => x.RequestedByAccountId == actor));

        // Human-attributed/manual HTTP capture is useful for audit/research but is not
        // allowed to train the Henna-owned learner. Training data must be first-party.
        var importedSnapshot = Guid.NewGuid();
        db.Assessments.Add(new() {
            Id = importedSnapshot, HouseholdKey = Guid.NewGuid(),
            RecordedByAccountId = reviewer, EvidenceReference = "manual-reviewed-input",
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = dataset, SourceInstructionReference = source,
            GeographicFactor = 1m, Health = 1, Hardship = 1, Age = 1,
            Size = 1, Care = 1, Education = 1, AllocatedRial = 100,
            AssessedAtUtc = clock.UtcNow.AddDays(-1), RecordedAtUtc = clock.UtcNow
        });
        await db.SaveChangesAsync();
        var importedLabel = await workflow.ReviewNeedAsync(reviewer, importedSnapshot, .5m,
            "synthetic-import-rubric", LearningPartition.Training);
        var mixed = labels.Take(39).Append(importedLabel).ToArray();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            workflow.TrainAsync(actor, mixed, 4000, clock.UtcNow));

        db.ChangeTracker.Clear();
        var stored = await db.TrainingRuns.SingleAsync(x => x.Id == run.Id);
        stored.Status = "NO_IMPROVEMENT";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }
}
