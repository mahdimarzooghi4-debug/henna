using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationShadowModelBenchmarkServiceTests
{
    [Fact]
    public async Task XGBoostShadowIsEvaluatedIdempotentlyWithoutProductionEffect()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_shadow_benchmark_" +
            Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;

        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var learning = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory",
                        "allocation_learning"))
                .Options);
        await identity.Database.MigrateAsync();
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(
            2026, 10, 7, 7, 0, 0, TimeSpan.Zero);
        var admin = Guid.NewGuid();
        var secondAdmin = Guid.NewGuid();
        identity.Accounts.Add(new()
        {
            Id = admin,
            NormalizedPhone = "09123456789",
            CreatedAtUtc = now
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = admin,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        identity.Accounts.Add(new()
        {
            Id = secondAdmin,
            NormalizedPhone = "09123456788",
            CreatedAtUtc = now
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = secondAdmin,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        await identity.SaveChangesAsync();

        var baseline = AllocationWeightProfile.Baseline;
        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
        var reviewer = admin;
        var target = new[] { .35m, .20m, .18m, .12m, .10m, .05m };
        var frozenExamples = Enumerable.Range(0, 40).Select(i =>
        {
            var scores = Enumerable.Range(0, 6)
                .Select(k => k == i % 6 ? 3 : 0).ToArray();
            return new ReviewedNeedExample(
                Guid.NewGuid(),
                new(
                    scores[0],
                    scores[1],
                    scores[2],
                    scores[3],
                    scores[4],
                    scores[5]),
                target[i % 6],
                reviewer,
                "shadow-training-rubric-v1",
                now.AddDays(-2).AddMinutes(i),
                i < 30
                    ? LearningPartition.Training
                    : LearningPartition.Validation);
        }).ToArray();
        var artifact = HennaXGBoostOfflineLearner.Train(
            frozenExamples, now.AddDays(-1));

        var runId = Guid.NewGuid();
        learning.TrainingRuns.Add(new()
        {
            Id = runId,
            RequestedByAccountId = admin,
            Status = "NO_IMPROVEMENT",
            DatasetVersion = dataset,
            ModelVersion =
                ExperimentalAllocationWeightLearner.ModelVersion,
            InputsJson = JsonSerializer.Serialize(new
            {
                examples = frozenExamples,
                baseline,
                baselineRuntimeProposalId = (Guid?)null,
                baselineRuntimeProfileSequence = (long?)0,
                poolRial = 1000L,
                sourceInstructionReference = source
            }),
            ShadowModelVersion = artifact.ModelVersion,
            ShadowArtifactFormat = artifact.ArtifactFormat,
            ShadowArtifactSha256 = artifact.ArtifactSha256,
            ShadowArtifactBytes = artifact.ArtifactBytes,
            ShadowParametersJson = artifact.ParametersJson,
            ShadowMetricsJson = JsonSerializer.Serialize(
                artifact.Metrics),
            CutoffUtc = now.AddDays(-1),
            RecordedAtUtc = now.AddDays(-1)
        });

        var snapshots = new[]
        {
            new AllocationAssessmentRecord
            {
                Id = Guid.NewGuid(),
                HouseholdKey = Guid.NewGuid(),
                FormulaVersion = baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                GeographicFactor = 1m,
                Health = 3,
                AllocatedRial = 100,
                AssessedAtUtc = now.AddHours(-4),
                RecordedAtUtc = now.AddHours(-4)
            },
            new AllocationAssessmentRecord
            {
                Id = Guid.NewGuid(),
                HouseholdKey = Guid.NewGuid(),
                FormulaVersion = baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                GeographicFactor = 1m,
                Hardship = 3,
                AllocatedRial = 100,
                AssessedAtUtc = now.AddHours(-4),
                RecordedAtUtc = now.AddHours(-4)
            }
        };
        learning.Assessments.AddRange(snapshots);
        var labels = new[]
        {
            new ReviewedNeedLabelRecord
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshots[0].Id,
                ReviewerAccountId = reviewer,
                NeedScore = .35m,
                RubricVersion = "shadow-evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-2)
            },
            new ReviewedNeedLabelRecord
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshots[1].Id,
                ReviewerAccountId = reviewer,
                NeedScore = .20m,
                RubricVersion = "shadow-evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-2)
            }
        };
        learning.NeedLabels.AddRange(labels);
        await learning.SaveChangesAsync();

        var clock = new FixedClock(now);
        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var service = new AllocationShadowModelBenchmarkService(
            learning, roles, clock);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.EvaluateAsync(
                Guid.NewGuid(),
                runId,
                labels.Select(x => x.Id).ToArray(),
                now.AddHours(-1)));

        var first = await service.EvaluateAsync(
            admin,
            runId,
            labels.Select(x => x.Id).ToArray(),
            now.AddHours(-1));
        learning.ChangeTracker.Clear();

        var replay = await service.EvaluateAsync(
            admin,
            runId,
            labels.Select(x => x.Id).Reverse().ToArray(),
            now.AddHours(-1));

        await Assert.ThrowsAsync<AllocationShadowModelBenchmarkConflictException>(
            () => service.EvaluateAsync(
                secondAdmin,
                runId,
                labels.Select(x => x.Id).ToArray(),
                now.AddHours(-1)));

        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(
            HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion,
            first.ProtocolVersion);
        Assert.Equal(
            HennaXGBoostOfflineLearner.ModelVersion,
            first.ModelVersion);
        Assert.Equal(artifact.ArtifactSha256, first.ArtifactSha256);
        Assert.Equal(baseline.Version, first.BaselineVersion);
        Assert.Equal(0, first.RuntimeProfileSequence);
        Assert.Null(first.RuntimeProposalId);
        Assert.Equal(64, first.EvaluationFingerprint.Length);
        Assert.Single(
            await learning.ShadowModelBenchmarks.AsNoTracking()
                .Where(x => x.Id == first.Id)
                .ToListAsync());
        Assert.Empty(await learning.Proposals.AsNoTracking().ToListAsync());
        Assert.Empty(
            await learning.RuntimeProfileEvents.AsNoTracking()
                .ToListAsync());

        var metrics =
            JsonSerializer.Deserialize<HennaXGBoostShadowBenchmarkMetrics>(
                first.MetricsJson)!;
        Assert.Equal(2, metrics.EvaluationCount);
        Assert.True(double.IsFinite(metrics.BaselineMse));
        Assert.True(double.IsFinite(metrics.ShadowMse));
        Assert.True(double.IsFinite(
            metrics.ShadowMinusBaselineMse));
        Assert.NotNull(metrics.BaselineDiagnostics);
        Assert.NotNull(metrics.ShadowDiagnostics);
        Assert.Equal(metrics.ShadowMse,
            metrics.ShadowDiagnostics!.Mse, 12);
        Assert.True(double.IsFinite(metrics.ShadowDiagnostics.Mae));
        Assert.True(double.IsFinite(
            metrics.ShadowDiagnostics.MeanResidual));

        var comparisonExamples = labels.Select(label =>
        {
            var snapshot = snapshots.Single(x => x.Id == label.SnapshotId);
            return new ReviewedNeedExample(
                snapshot.HouseholdKey,
                new(
                    snapshot.Health,
                    snapshot.Hardship,
                    snapshot.Age,
                    snapshot.Size,
                    snapshot.Care,
                    snapshot.Education),
                label.NeedScore,
                label.ReviewerAccountId,
                label.RubricVersion,
                label.ReviewedAtUtc,
                LearningPartition.Evaluation);
        }).ToArray();
        var comparable = AllocationModelBenchmarkEvaluator.Evaluate(
            comparisonExamples,
            baseline,
            new AllocationWeightProfile(
                "comparison-only-candidate",
                .34m, .21m, .18m, .12m, .10m, .05m),
            now.AddHours(-1));
        Assert.Equal(
            comparable.EvaluationFingerprint,
            metrics.EvaluationFingerprint);

        var overlapSnapshot = new AllocationAssessmentRecord
        {
            Id = Guid.NewGuid(),
            HouseholdKey = frozenExamples[0].HouseholdKey,
            FormulaVersion = baseline.Version,
            RuntimeProfileSequence = 0,
            DatasetVersion = dataset,
            SourceInstructionReference = source,
            GeographicFactor = 1m,
            Health = 3,
            AllocatedRial = 100,
            AssessedAtUtc = now.AddHours(-3),
            RecordedAtUtc = now.AddHours(-3)
        };
        learning.Assessments.Add(overlapSnapshot);
        var overlapLabel = new ReviewedNeedLabelRecord
        {
            Id = Guid.NewGuid(),
            SnapshotId = overlapSnapshot.Id,
            ReviewerAccountId = reviewer,
            NeedScore = .35m,
            RubricVersion = "shadow-evaluation-rubric-overlap",
            Partition = (int)LearningPartition.Evaluation,
            ReviewedAtUtc = now.AddHours(-2)
        };
        learning.NeedLabels.Add(overlapLabel);
        await learning.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.EvaluateAsync(
                admin,
                runId,
                new[] { overlapLabel.Id },
                now.AddHours(-1)));
    }

    private static async Task CreateDatabase(
        string root, string name)
    {
        await using var admin = new NpgsqlConnection(root);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand(
            "CREATE DATABASE " + name, admin);
        await create.ExecuteNonQueryAsync();
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow => now;
    }
}
