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
        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
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

        var missingPolicy = new AllocationLearningAutomationPolicy(
            Enabled: false,
            AutomationAccountId: null,
            MinimumTrainingLabels: null,
            MinimumValidationLabels: null,
            PoolRial: null);
        var waitingAutomation = await new AllocationLearningAutomationPlanner(
            db, missingPolicy).BuildAsync();
        Assert.Equal("TRIGGER_POLICY_REQUIRED", waitingAutomation.Status);
        Assert.False(waitingAutomation.TriggerPolicyConfigured);
        Assert.False(waitingAutomation.AutomaticTrainingEnabled);
        Assert.Contains("ENABLED", waitingAutomation.MissingPolicyRequirements);
        Assert.Contains("POOL_RIAL", waitingAutomation.MissingPolicyRequirements);

        var configuredPolicy = new AllocationLearningAutomationPolicy(
            Enabled: true,
            AutomationAccountId: actor,
            MinimumTrainingLabels: 36,
            MinimumValidationLabels: 12,
            PoolRial: 4800);
        var automation = await new AllocationLearningAutomationPlanner(
            db, configuredPolicy).BuildAsync();
        Assert.Equal("AUTOMATION_EXECUTOR_REQUIRED", automation.Status);
        Assert.True(automation.TriggerPolicyConfigured);
        Assert.False(automation.AutomaticTrainingEnabled);
        Assert.Empty(automation.MissingPolicyRequirements);
        var cohort = Assert.Single(automation.Cohorts);
        Assert.Equal(dataset, cohort.DatasetVersion);
        Assert.Equal(source, cohort.SourceInstructionReference);
        Assert.Equal("synthetic-rubric-1", cohort.RubricVersion);
        Assert.Equal(36, cohort.TrainingLabelCount);
        Assert.Equal(12, cohort.ValidationLabelCount);
        Assert.Equal(36, cohort.DistinctTrainingHouseholds);
        Assert.Equal(12, cohort.DistinctValidationHouseholds);
        Assert.False(cohort.HouseholdPartitionOverlap);
        Assert.Equal(labels.OrderBy(x => x), cohort.LabelIds);
        Assert.True(cohort.MeetsConfiguredTrigger);
        Assert.NotNull(cohort.RequestId);
        var sameRequest = AllocationLearningAutomationIdentity.RequestId(
            cohort, configuredPolicy.PoolRial!.Value);
        Assert.Equal(cohort.RequestId, sameRequest);
        Assert.NotEqual(cohort.RequestId,
            AllocationLearningAutomationIdentity.RequestId(cohort, 4801));

        var runKey = Guid.NewGuid();
        var run = await workflow.TrainAsync(
            actor, labels, 4800, clock.UtcNow, runKey);
        Assert.Equal(runKey, run.Id);
        Assert.Equal("PROPOSED", run.Status);
        Assert.NotNull(run.ProposalId);
        Assert.NotNull(run.MetricsJson);

        var replay = await workflow.TrainAsync(
            actor, labels, 4800, clock.UtcNow, runKey);
        Assert.Equal(run.Id, replay.Id);
        Assert.Equal(run.ProposalId, replay.ProposalId);
        Assert.Single(await db.TrainingRuns.AsNoTracking()
            .Where(x => x.Id == runKey).ToListAsync());
        await Assert.ThrowsAsync<AllocationTrainingIdempotencyConflictException>(
            () => workflow.TrainAsync(
                actor, labels, 4801, clock.UtcNow, runKey));
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
        await Assert.ThrowsAsync<ArgumentException>(() =>
            workflow.ReviewNeedAsync(reviewer, importedSnapshot, .5m,
                "synthetic-import-rubric", LearningPartition.Training));

        // Null attribution alone is not enough. A row must also carry the
        // immutable first-party Henna dataset and program identity.
        var unattributedResearchSnapshot = Guid.NewGuid();
        db.Assessments.Add(new() {
            Id = unattributedResearchSnapshot, HouseholdKey = Guid.NewGuid(),
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = "research-unattributed-" + Guid.NewGuid(),
            SourceInstructionReference = "manual-research",
            GeographicFactor = 1m, Health = 1, Hardship = 1, Age = 1,
            Size = 1, Care = 1, Education = 1, AllocatedRial = 100,
            AssessedAtUtc = clock.UtcNow.AddDays(-1), RecordedAtUtc = clock.UtcNow
        });
        await db.SaveChangesAsync();
        var unattributed = await db.Assessments.AsNoTracking()
            .SingleAsync(x => x.Id == unattributedResearchSnapshot);
        Assert.False(
            AllocationTrainingWorkflow.IsTrainingEligibleFirstPartySnapshot(
                unattributed));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            workflow.ReviewNeedAsync(
                reviewer, unattributedResearchSnapshot, .5m,
                "synthetic-unattributed-rubric",
                LearningPartition.Training));

        // Defense in depth: even a privileged direct DB insertion cannot make an
        // attributed/manual snapshot training-eligible.
        var importedLabel = Guid.NewGuid();
        db.NeedLabels.Add(new() {
            Id = importedLabel, SnapshotId = importedSnapshot,
            ReviewerAccountId = reviewer, NeedScore = .5m,
            RubricVersion = "synthetic-rubric-1",
            Partition = (int)LearningPartition.Validation,
            ReviewedAtUtc = clock.UtcNow
        });
        await db.SaveChangesAsync();
        var mixed = labels.Take(39).Append(importedLabel).ToArray();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            workflow.TrainAsync(actor, mixed, 4000, clock.UtcNow));

        db.ChangeTracker.Clear();
        var stored = await db.TrainingRuns.SingleAsync(x => x.Id == run.Id);
        stored.Status = "NO_IMPROVEMENT";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }
}
