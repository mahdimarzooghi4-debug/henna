using System.Security.Cryptography;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationEbmEvidenceServiceTests
{
    private const string ModelVersion = "henna-ebm-v1-offline";
    private const string ArtifactFormat = "henna-ebm-portable-json-v1";
    private const string LibraryName = "interpret-core";
    private const string LibraryVersion = "0.7.8";
    private const string PredictionLookupIndex = "base4(featureOrder)";

    [Fact]
    public async Task EbmArtifactAndBenchmarkStayAppendOnlyAndProductionNeutral()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_ebm_evidence_" + Guid.NewGuid().ToString("N");
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
            2026, 10, 7, 10, 0, 0, TimeSpan.Zero);
        var admin = Guid.NewGuid();
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
        await identity.SaveChangesAsync();

        var baseline = AllocationWeightProfile.Baseline;
        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
        var target = new[] { .35m, .20m, .18m, .12m, .10m, .05m };
        var cutoff = now.AddDays(-1);
        var frozenExamples = Enumerable.Range(0, 48).Select(i =>
        {
            var values = Enumerable.Range(0, 6)
                .Select(k => k == i % 6 ? 3 : 0).ToArray();
            return new ReviewedNeedExample(
                Guid.NewGuid(),
                new(
                    values[0], values[1], values[2],
                    values[3], values[4], values[5]),
                target[i % 6],
                admin,
                "ebm-training-rubric-v1",
                cutoff.AddMinutes(-i - 1),
                i < 36
                    ? LearningPartition.Training
                    : LearningPartition.Validation);
        }).ToArray();

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
            CutoffUtc = cutoff,
            RecordedAtUtc = cutoff
        });
        await learning.SaveChangesAsync();

        var lookup = BuildLookup(target.Select(x => (double)x).ToArray());
        var artifactBytes = JsonSerializer.SerializeToUtf8Bytes(new
        {
            schema = ArtifactFormat,
            modelVersion = ModelVersion,
            library = new
            {
                name = LibraryName,
                version = LibraryVersion
            },
            featureOrder = new[]
            {
                "health", "hardship", "age",
                "size", "care", "education"
            },
            featureDomain = new[] { 0, 1, 2, 3 },
            predictionLookupIndex =
                PredictionLookupIndex,
            predictionLookup = lookup,
            officialInterpretMlModel = new
            {
                syntheticTestFixture = true
            }
        });
        var sha = Convert.ToHexString(
            SHA256.HashData(artifactBytes)).ToLowerInvariant();
        var reportJson = JsonSerializer.Serialize(new
        {
            modelVersion = ModelVersion,
            artifactFormat = ArtifactFormat,
            artifactSha256 = sha,
            library = new
            {
                name = LibraryName,
                version = LibraryVersion
            },
            execution = new
            {
                engine = "HENNA_OWNED_LOCAL",
                mode = "OFFLINE_RESEARCH_CHALLENGER",
                networkModelApi = false,
                dataOrigin = "HENNA_FIRST_PARTY"
            },
            parameters = new
            {
                interactions = 0,
                monotone_constraints = (object?)null
            },
            metrics = new
            {
                trainingCount = 36,
                validationCount = 12,
                trainingMse = 0d,
                validationMse = 0d,
                rubricVersion = "ebm-training-rubric-v1",
                cutoffUtc = cutoff
            },
            governance = new
            {
                winner = (string?)null,
                approved = false,
                proposalCreated = false,
                pilotAuthorized = false,
                runtimeApplied = false
            }
        });

        var clock = new FixedClock(now);
        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var artifacts = new AllocationEbmArtifactService(
            learning, roles, clock);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            artifacts.RegisterAsync(
                Guid.NewGuid(), runId, artifactBytes, reportJson));

        var registered = await artifacts.RegisterAsync(
            admin, runId, artifactBytes, reportJson);
        learning.ChangeTracker.Clear();
        var replay = await artifacts.RegisterAsync(
            admin, runId, artifactBytes, reportJson);
        Assert.Equal(registered.Id, replay.Id);
        Assert.Equal(sha, registered.ArtifactSha256);
        Assert.Single(await learning.EbmArtifacts.AsNoTracking().ToListAsync());
        Assert.Empty(await learning.Proposals.AsNoTracking().ToListAsync());
        Assert.Empty(await learning.RuntimeProfileEvents.AsNoTracking().ToListAsync());

        var leakedArtifact = JsonSerializer.SerializeToUtf8Bytes(new
        {
            schema = ArtifactFormat,
            modelVersion = ModelVersion,
            library = new
            {
                name = LibraryName,
                version = LibraryVersion
            },
            featureOrder = new[]
            {
                "health", "hardship", "age",
                "size", "care", "education"
            },
            featureDomain = new[] { 0, 1, 2, 3 },
            predictionLookupIndex =
                PredictionLookupIndex,
            predictionLookup = lookup,
            officialInterpretMlModel = new
            {
                leakedHousehold = frozenExamples[0].HouseholdKey
            }
        });
        var leakedSha = Convert.ToHexString(
            SHA256.HashData(leakedArtifact)).ToLowerInvariant();
        var leakedReport = reportJson.Replace(sha, leakedSha);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            artifacts.RegisterAsync(
                admin, Guid.NewGuid(), leakedArtifact, leakedReport));

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
                ReviewerAccountId = admin,
                NeedScore = .35m,
                RubricVersion = "shared-evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-2)
            },
            new ReviewedNeedLabelRecord
            {
                Id = Guid.NewGuid(),
                SnapshotId = snapshots[1].Id,
                ReviewerAccountId = admin,
                NeedScore = .20m,
                RubricVersion = "shared-evaluation-rubric-v1",
                Partition = (int)LearningPartition.Evaluation,
                ReviewedAtUtc = now.AddHours(-2)
            }
        };
        learning.NeedLabels.AddRange(labels);
        await learning.SaveChangesAsync();
        learning.ChangeTracker.Clear();

        var benchmarks = new AllocationEbmBenchmarkService(
            learning, roles, clock);
        var first = await benchmarks.EvaluateAsync(
            admin,
            runId,
            labels.Select(x => x.Id).ToArray(),
            now.AddHours(-1));
        learning.ChangeTracker.Clear();
        var benchmarkReplay = await benchmarks.EvaluateAsync(
            admin,
            runId,
            labels.Select(x => x.Id).Reverse().ToArray(),
            now.AddHours(-1));

        Assert.Equal(first.Id, benchmarkReplay.Id);
        Assert.Equal(registered.Id, first.EbmArtifactId);
        Assert.Equal(
            HennaEbmBenchmarkEvaluator.ProtocolVersion,
            first.ProtocolVersion);
        Assert.Equal(
            ModelVersion,
            first.ModelVersion);
        Assert.Equal(sha, first.ArtifactSha256);
        Assert.Equal(64, first.EvaluationFingerprint.Length);

        var metrics = JsonSerializer.Deserialize<HennaEbmBenchmarkMetrics>(
            first.MetricsJson)!;
        Assert.Equal(2, metrics.EvaluationCount);
        Assert.Equal(0d, metrics.EbmMse, 12);
        Assert.NotNull(metrics.BaselineDiagnostics);
        Assert.NotNull(metrics.EbmDiagnostics);
        Assert.Equal(0d, metrics.EbmDiagnostics!.Mse, 12);
        Assert.Equal(0d, metrics.EbmDiagnostics.Mae, 12);
        Assert.Equal(0d, metrics.EbmDiagnostics.MeanResidual, 12);
        Assert.Equal(1d,
            metrics.EbmDiagnostics.CalibrationSlope!.Value, 12);
        Assert.Equal(0d,
            metrics.EbmDiagnostics.CalibrationIntercept!.Value, 12);

        var comparisonExamples = labels.Select(label =>
        {
            var snapshot = snapshots.Single(
                x => x.Id == label.SnapshotId);
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
        Assert.Single(await learning.EbmModelBenchmarks.AsNoTracking()
            .ToListAsync());
        Assert.Empty(await learning.Proposals.AsNoTracking().ToListAsync());
        Assert.Empty(await learning.RuntimeProfileEvents.AsNoTracking().ToListAsync());
    }

    private static double[] BuildLookup(double[] weights)
    {
        var values = new double[4096];
        for (var index = 0; index < values.Length; index++)
        {
            var cursor = index;
            var scores = new int[6];
            for (var i = 5; i >= 0; i--)
            {
                scores[i] = cursor % 4;
                cursor /= 4;
            }
            values[index] = Enumerable.Range(0, 6)
                .Sum(i => weights[i] * scores[i] / 3d);
        }
        return values;
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
