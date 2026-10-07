using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationModelBenchmarkServiceTests
{
    [Fact]
    public async Task IndependentEvaluationIsPersistedIdempotentlyForOneRuntimeLineage()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_model_benchmark_" + Guid.NewGuid().ToString("N");
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
                        "__EFMigrationsHistory", "allocation_learning"))
                .Options);
        await identity.Database.MigrateAsync();
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(
            2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var admin = Guid.NewGuid();
        var secondAdmin = Guid.NewGuid();
        identity.Accounts.Add(new AccountRecord
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

        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
        var snapshots = new[]
        {
            new AllocationAssessmentRecord
            {
                Id = Guid.NewGuid(),
                HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                GeographicFactor = 1m,
                Health = 3,
                AllocatedRial = 100,
                AssessedAtUtc = now.AddDays(-2),
                RecordedAtUtc = now.AddDays(-2)
            },
            new AllocationAssessmentRecord
            {
                Id = Guid.NewGuid(),
                HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = dataset,
                SourceInstructionReference = source,
                GeographicFactor = 1m,
                Hardship = 3,
                AllocatedRial = 100,
                AssessedAtUtc = now.AddDays(-2),
                RecordedAtUtc = now.AddDays(-2)
            }
        };
        learning.Assessments.AddRange(snapshots);

        var proposalId = Guid.NewGuid();
        var candidate = new AllocationWeightProfile(
            "benchmark-service-candidate",
            .35m,.20m,.18m,.12m,.10m,.05m);
        learning.Proposals.Add(new()
        {
            Id = proposalId,
            CreatedByAccountId = admin,
            CandidateVersion = candidate.Version,
            ModelVersion = "candidate-family-under-test",
            Rationale = "Benchmark candidate only; no automatic selection.",
            BaselineVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = dataset,
            SourceInstructionReference = source,
            PoolRial = 1000,
            WeightsJson = JsonSerializer.Serialize(candidate),
            SnapshotIdsJson = JsonSerializer.Serialize(
                snapshots.Select(x => x.Id).ToArray()),
            SimulationJson = "{}",
            CreatedAtUtc = now.AddDays(-1)
        });

        var labels = new[]
        {
            new ReviewedNeedLabelRecord
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshots[0].Id,
                ReviewerAccountId = admin,
                NeedScore = .35m,
                RubricVersion = "evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-3)
            },
            new ReviewedNeedLabelRecord
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshots[1].Id,
                ReviewerAccountId = admin,
                NeedScore = .20m,
                RubricVersion = "evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-2)
            }
        };
        learning.NeedLabels.AddRange(labels);
        await learning.SaveChangesAsync();

        var clock = new FixedClock(now);
        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var service = new AllocationModelBenchmarkService(
            learning, roles, clock);

        var first = await service.EvaluateAsync(
            admin,
            proposalId,
            labels.Select(x => x.Id).ToArray(),
            now.AddHours(-1));
        learning.ChangeTracker.Clear();

        var replay = await service.EvaluateAsync(
            admin,
            proposalId,
            labels.Select(x => x.Id).Reverse().ToArray(),
            now.AddHours(-1));

        await Assert.ThrowsAsync<AllocationModelBenchmarkConflictException>(
            () => service.EvaluateAsync(
                secondAdmin,
                proposalId,
                labels.Select(x => x.Id).ToArray(),
                now.AddHours(-1)));

        Assert.Equal(first.Id, replay.Id);
        Assert.Equal(
            AllocationModelBenchmarkEvaluator.ProtocolVersion,
            first.ProtocolVersion);
        Assert.Equal(candidate.Version, first.CandidateVersion);
        Assert.Equal(
            AllocationWeightProfile.Baseline.Version,
            first.BaselineVersion);
        Assert.Equal(0, first.RuntimeProfileSequence);
        Assert.Null(first.RuntimeProposalId);
        Assert.Equal(64, first.EvaluationFingerprint.Length);
        Assert.Single(await learning.ModelBenchmarks.AsNoTracking()
            .Where(x => x.Id == first.Id).ToListAsync());

        var metrics = JsonSerializer.Deserialize<AllocationModelBenchmarkMetrics>(
            first.MetricsJson)!;
        Assert.Equal(2, metrics.EvaluationCount);
        Assert.Equal(0m, metrics.CandidateMse);
        Assert.True(metrics.BaselineMse > metrics.CandidateMse);
        Assert.NotNull(metrics.BaselineDiagnostics);
        Assert.NotNull(metrics.CandidateDiagnostics);
        Assert.Equal(0d, metrics.CandidateDiagnostics!.Mse, 12);
        Assert.Equal(0d, metrics.CandidateDiagnostics.MeanResidual, 12);
        Assert.Equal(1d,
            metrics.CandidateDiagnostics.CalibrationSlope!.Value, 12);

        var attributedId = Guid.NewGuid();
        learning.Assessments.Add(new()
        {
            Id = attributedId,
            HouseholdKey = Guid.NewGuid(),
            RecordedByAccountId = admin,
            EvidenceReference = "manual-benchmark-evidence",
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = dataset,
            SourceInstructionReference = source,
            GeographicFactor = 1m,
            Health = 3,
            AllocatedRial = 100,
            AssessedAtUtc = now.AddDays(-2),
            RecordedAtUtc = now.AddDays(-2)
        });
        var attributedLabelId = Guid.NewGuid();
        learning.NeedLabels.Add(new()
        {
            Id = attributedLabelId,
            SnapshotId = attributedId,
            ReviewerAccountId = admin,
            NeedScore = .35m,
            RubricVersion = "evaluation-rubric-v1",
            Partition = (int)LearningPartition.Evaluation,
            ReviewedAtUtc = now.AddHours(-2)
        });
        await learning.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.EvaluateAsync(
                admin,
                proposalId,
                new[] { attributedLabelId },
                now.AddHours(-1)));
    }

    private static async Task CreateDatabase(string root, string name)
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
