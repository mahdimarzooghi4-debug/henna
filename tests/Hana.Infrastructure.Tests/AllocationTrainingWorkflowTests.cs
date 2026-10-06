using System.Security.Cryptography;
using System.Text.Json;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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
                FormulaVersion = AllocationWeightProfile.Baseline.Version, RuntimeProfileSequence = 0,
                DatasetVersion = dataset, SourceInstructionReference = source, GeographicFactor = 1m, Health = scores[0],
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
            PoolRial: 4800,
            PollIntervalMinutes: 5);
        var configuredPlanner = new AllocationLearningAutomationPlanner(
            db, configuredPolicy);
        var automation = await configuredPlanner.BuildAsync();
        Assert.Equal("AUTOMATION_ENABLED", automation.Status);
        Assert.True(automation.TriggerPolicyConfigured);
        Assert.True(automation.AutomaticTrainingEnabled);
        Assert.Empty(automation.MissingPolicyRequirements);
        var cohort = Assert.Single(automation.Cohorts.Where(x =>
            x.DatasetVersion == dataset &&
            x.SourceInstructionReference == source &&
            x.RubricVersion == "synthetic-rubric-1"));
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

        var executor = new AllocationLearningAutomationExecutor(
            configuredPlanner, configuredPolicy, workflow);
        var execution = await executor.ExecuteReadyAsync();
        Assert.Equal("EXECUTED", execution.Status);
        Assert.Equal(1, execution.ReadyCohortCount);
        var executed = Assert.Single(execution.Runs);
        var runKey = cohort.RequestId!.Value;
        Assert.Equal(runKey, executed.RequestId);
        Assert.Equal(runKey, executed.RunId);
        Assert.Equal("PROPOSED", executed.Status);
        Assert.NotNull(executed.ProposalId);

        var run = await db.TrainingRuns.AsNoTracking()
            .SingleAsync(x => x.Id == runKey);
        Assert.Equal("PROPOSED", run.Status);
        Assert.NotNull(run.ProposalId);
        Assert.NotNull(run.MetricsJson);

        var replayExecution = await executor.ExecuteReadyAsync();
        var replay = Assert.Single(replayExecution.Runs);
        Assert.Equal(run.Id, replay.RunId);
        Assert.Equal(run.ProposalId, replay.ProposalId);
        Assert.Single(await db.TrainingRuns.AsNoTracking()
            .Where(x => x.Id == runKey).ToListAsync());
        await Assert.ThrowsAsync<AllocationTrainingIdempotencyConflictException>(
            () => workflow.TrainAsync(
                actor, labels, 4801, cohort.LatestReviewedAtUtc, runKey));
        var proposal = await db.Proposals.AsNoTracking().SingleAsync(x => x.Id == run.ProposalId);
        Assert.Equal(ExperimentalAllocationWeightLearner.ModelVersion, proposal.ModelVersion);
        Assert.False(await db.Reviews.AnyAsync(x => x.ProposalId == proposal.Id));
        using var frozen = JsonDocument.Parse(run.InputsJson);
        Assert.Equal("HENNA_OWNED_LOCAL", frozen.RootElement.GetProperty("engine").GetString());
        Assert.False(frozen.RootElement.GetProperty("networkModelApi").GetBoolean());
        Assert.Equal("HENNA_FIRST_PARTY", frozen.RootElement.GetProperty("dataOrigin").GetString());
        Assert.Equal(48, frozen.RootElement.GetProperty("examples").GetArrayLength());

        var concurrentLabels = new List<Guid>();
        for (var i = 0; i < snapshotIds.Length; i++)
            concurrentLabels.Add(await workflow.ReviewNeedAsync(
                reviewer,
                snapshotIds[i],
                new[] { .35m, .20m, .18m, .12m, .10m, .05m }[i % 6],
                "synthetic-rubric-concurrent",
                i < 36 ? LearningPartition.Training : LearningPartition.Validation));

        var concurrentKey = Guid.NewGuid();
        var concurrentCutoff = clock.UtcNow;
        await using var identityA = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var identityB = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var dbA = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg => pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        await using var dbB = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg => pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        var workflowA = new AllocationTrainingWorkflow(
            dbA,
            new RoleAuthorizationService(
                identityA, new AuthSessionService(identityA, clock)),
            clock,
            new AllocationProposalService(dbA, clock));
        var workflowB = new AllocationTrainingWorkflow(
            dbB,
            new RoleAuthorizationService(
                identityB, new AuthSessionService(identityB, clock)),
            clock,
            new AllocationProposalService(dbB, clock));

        var concurrentRuns = await Task.WhenAll(
            workflowA.TrainAsync(
                actor, concurrentLabels, 4900, concurrentCutoff, concurrentKey),
            workflowB.TrainAsync(
                actor, concurrentLabels, 4900, concurrentCutoff, concurrentKey));
        Assert.All(concurrentRuns, x => Assert.Equal(concurrentKey, x.Id));
        Assert.Equal(
            concurrentRuns[0].ProposalId,
            concurrentRuns[1].ProposalId);
        Assert.Single(await db.TrainingRuns.AsNoTracking()
            .Where(x => x.Id == concurrentKey).ToListAsync());

        var baselineLabels = new List<Guid>();
        for (var i = 0; i < snapshotIds.Length; i++) baselineLabels.Add(await workflow.ReviewNeedAsync(reviewer,
            snapshotIds[i], new[] { .30m, .25m, .18m, .12m, .10m, .05m }[i % 6], "synthetic-rubric-2",
            i < 36 ? LearningPartition.Training : LearningPartition.Validation));
        var rejected = await workflow.TrainAsync(actor, baselineLabels, 4800, clock.UtcNow);
        Assert.Equal("NO_IMPROVEMENT", rejected.Status);
        Assert.Null(rejected.ProposalId);
        var actorRuns = await db.TrainingRuns.AsNoTracking()
            .Where(x => x.RequestedByAccountId == actor)
            .ToListAsync();
        Assert.Contains(actorRuns, x => x.Id == runKey && x.Status == "PROPOSED");
        Assert.Contains(actorRuns, x => x.Id == concurrentKey && x.Status == "PROPOSED");
        Assert.Contains(actorRuns, x => x.Id == rejected.Id && x.Status == "NO_IMPROVEMENT");

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
            AllocationTrainingLineageResolver.HasFirstPartyHennaProvenance(
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

    [Fact]
    public async Task PromotedRuntimeLineageCanTrainTheNextControlledGeneration()
    {
        var rootConnection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(rootConnection)) return;

        var database = "henna_iterative_training_" + Guid.NewGuid().ToString("N");
        await using (var admin = new NpgsqlConnection(rootConnection))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand(
                "CREATE DATABASE " + database, admin);
            await create.ExecuteNonQueryAsync();
        }
        var connection = new NpgsqlConnectionStringBuilder(rootConnection)
        {
            Database = database
        }.ConnectionString;

        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var db = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg => pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        await identity.Database.MigrateAsync();
        await db.Database.MigrateAsync();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var clock = new SystemClock();
        var actor = Guid.NewGuid();
        var reviewer = Guid.NewGuid();
        foreach (var id in new[] { actor, reviewer })
        {
            identity.Accounts.Add(new()
            {
                Id = id,
                NormalizedPhone = "09" +
                    RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
                CreatedAtUtc = clock.UtcNow
            });
            identity.RoleAssignments.Add(new()
            {
                AccountId = id,
                Role = HanaRoles.Admin,
                GrantedAtUtc = clock.UtcNow
            });
        }
        await identity.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var workflow = new AllocationTrainingWorkflow(
            db, roles, clock, new AllocationProposalService(db, clock));

        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
        var promoted = new AllocationWeightProfile(
            "henna-promoted-ci-" + Guid.NewGuid().ToString("N"),
            .35m, .20m, .18m, .12m, .10m, .05m);
        var runtimeProposalId = Guid.NewGuid();
        var promotedAt = clock.UtcNow.AddHours(-2);

        long runtimeSequence;
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            await db.Database.ExecuteSqlRawAsync(
                "SELECT pg_advisory_xact_lock(48710261005)");
            runtimeSequence = checked((await db.RuntimeProfileEvents
                .Select(x => (long?)x.Sequence).MaxAsync() ?? 0L) + 1L);
            db.Proposals.Add(new()
            {
                Id = runtimeProposalId,
                CreatedByAccountId = actor,
                CandidateVersion = promoted.Version,
                ModelVersion = "ci-promoted-parent",
                Rationale = "Existing reviewed and promoted parent profile.",
                BaselineVersion = AllocationWeightProfile.Baseline.Version,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                PoolRial = 4800,
                WeightsJson = JsonSerializer.Serialize(promoted),
                SnapshotIdsJson = "[]",
                SimulationJson = "{}",
                CreatedAtUtc = promotedAt.AddMinutes(-10)
            });
            db.RuntimeProfileEvents.Add(new()
            {
                Id = Guid.NewGuid(),
                ProposalId = runtimeProposalId,
                ActorAccountId = actor,
                Sequence = runtimeSequence,
                EventType = "RUNTIME_PROMOTED",
                EffectiveProposalId = runtimeProposalId,
                EffectiveProfileVersion = promoted.Version,
                EffectiveWeightsJson = JsonSerializer.Serialize(promoted),
                PreviousProposalId = null,
                PreviousProfileVersion = AllocationWeightProfile.Baseline.Version,
                PreviousWeightsJson = JsonSerializer.Serialize(
                    AllocationWeightProfile.Baseline),
                Reason = "CI parent runtime profile.",
                RecordedAtUtc = promotedAt
            });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        var target = new[] { .30m, .25m, .18m, .12m, .10m, .05m };
        var snapshotIds = Enumerable.Range(0, 48)
            .Select(_ => Guid.NewGuid()).ToArray();
        for (var i = 0; i < snapshotIds.Length; i++)
        {
            var feature = i % 6;
            var scores = Enumerable.Range(0, 6)
                .Select(k => k == feature ? 3 : 0).ToArray();
            db.Assessments.Add(new()
            {
                Id = snapshotIds[i],
                HouseholdKey = Guid.NewGuid(),
                FormulaVersion = promoted.Version,
                RuntimeProposalId = runtimeProposalId,
                RuntimeProfileSequence = runtimeSequence,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                GeographicFactor = 1m,
                Health = scores[0],
                Hardship = scores[1],
                Age = scores[2],
                Size = scores[3],
                Care = scores[4],
                Education = scores[5],
                AllocatedRial = 100,
                AssessedAtUtc = clock.UtcNow.AddHours(-1),
                RecordedAtUtc = clock.UtcNow
            });
        }
        await db.SaveChangesAsync();

        var labels = new List<Guid>();
        for (var i = 0; i < snapshotIds.Length; i++)
            labels.Add(await workflow.ReviewNeedAsync(
                reviewer,
                snapshotIds[i],
                target[i % 6],
                "iterative-rubric-v1",
                i < 36
                    ? LearningPartition.Training
                    : LearningPartition.Validation));

        var policy = new AllocationLearningAutomationPolicy(
            Enabled: true,
            AutomationAccountId: actor,
            MinimumTrainingLabels: 36,
            MinimumValidationLabels: 12,
            PoolRial: 4800,
            PollIntervalMinutes: 5);
        var plan = await new AllocationLearningAutomationPlanner(
            db, policy).BuildAsync();
        var cohort = Assert.Single(plan.Cohorts.Where(x =>
            x.FormulaVersion == promoted.Version &&
            x.RuntimeProposalId == runtimeProposalId &&
            x.RuntimeProfileSequence == runtimeSequence &&
            x.SourceInstructionReference == source &&
            x.RubricVersion == "iterative-rubric-v1"));
        Assert.True(cohort.MeetsConfiguredTrigger);
        Assert.NotNull(cohort.RequestId);

        var run = await workflow.TrainAsync(
            actor,
            labels,
            4800,
            cohort.LatestReviewedAtUtc,
            cohort.RequestId);
        Assert.Equal("PROPOSED", run.Status);
        Assert.NotNull(run.ProposalId);

        var proposal = await db.Proposals.AsNoTracking()
            .SingleAsync(x => x.Id == run.ProposalId);
        Assert.Equal(promoted.Version, proposal.BaselineVersion);

        using var frozen = JsonDocument.Parse(run.InputsJson);
        Assert.Equal(promoted.Version,
            frozen.RootElement.GetProperty("baseline")
                .GetProperty("Version").GetString());
        Assert.Equal(runtimeProposalId,
            frozen.RootElement.GetProperty("baselineRuntimeProposalId")
                .GetGuid());
        Assert.Equal(runtimeSequence,
            frozen.RootElement.GetProperty("baselineRuntimeProfileSequence")
                .GetInt64());
    }

}
