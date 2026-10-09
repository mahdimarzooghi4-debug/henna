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

public sealed class AllocationRetentionTests
{
    [Fact]
    public async Task ExplicitPreviewPurgesOnlyUnconsumedAttributedResearchAndAuditsIt()
    {
        var root = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_retention_" + Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;

        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var learning = Learning(connection);
        await identity.Database.MigrateAsync();
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        var admin = Guid.NewGuid();
        var ordinary = Guid.NewGuid();
        identity.Accounts.AddRange(
            new AccountRecord
            {
                Id = admin,
                NormalizedPhone = "09111111111",
                CreatedAtUtc = now
            },
            new AccountRecord
            {
                Id = ordinary,
                NormalizedPhone = "09222222222",
                CreatedAtUtc = now
            });
        identity.RoleAssignments.Add(new()
        {
            AccountId = admin,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        await identity.SaveChangesAsync();

        var eligibleWithOutcome = Guid.NewGuid();
        var eligibleWithoutOutcome = Guid.NewGuid();
        var protectedByLabel = Guid.NewGuid();
        var protectedByProposal = Guid.NewGuid();
        var protectedByTraining = Guid.NewGuid();
        var protectedByRuntime = Guid.NewGuid();
        var firstParty = Guid.NewGuid();
        var newerAttributed = Guid.NewGuid();
        var cutoff = now.AddHours(-2);

        AllocationAssessmentRecord Attributed(Guid id, DateTimeOffset recorded) => new()
        {
            Id = id,
            HouseholdKey = Guid.NewGuid(),
            RecordedByAccountId = admin,
            EvidenceReference = "research-evidence-" + id,
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = "research-retention",
            SourceInstructionReference = "research-source",
            GeographicFactor = 1m,
            Health = 1,
            Hardship = 1,
            Age = 1,
            Size = 1,
            Care = 1,
            Education = 1,
            AllocatedRial = 100,
            AssessedAtUtc = recorded.AddMinutes(-5),
            RecordedAtUtc = recorded
        };

        learning.Assessments.AddRange(
            Attributed(eligibleWithOutcome, now.AddHours(-5)),
            Attributed(eligibleWithoutOutcome, now.AddHours(-4)),
            Attributed(protectedByLabel, now.AddHours(-4)),
            Attributed(protectedByProposal, now.AddHours(-4)),
            Attributed(protectedByTraining, now.AddHours(-4)),
            Attributed(protectedByRuntime, now.AddHours(-4)),
            Attributed(newerAttributed, now.AddMinutes(-30)));

        var runtimeProtected = learning.Assessments.Local.Single(
            x => x.Id == protectedByRuntime);
        runtimeProtected.RuntimeProfileSequence = 0;

        var program = Guid.NewGuid();
        learning.Assessments.Add(new()
        {
            Id = firstParty,
            HouseholdKey = Guid.NewGuid(),
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            RuntimeProfileSequence = 0,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:" + program,
            GeographicFactor = 1m,
            Health = 1,
            Hardship = 1,
            Age = 1,
            Size = 1,
            Care = 1,
            Education = 1,
            AllocatedRial = 100,
            AssessedAtUtc = now.AddHours(-5),
            RecordedAtUtc = now.AddHours(-4)
        });

        learning.Outcomes.Add(new()
        {
            Id = Guid.NewGuid(),
            SnapshotId = eligibleWithOutcome,
            PeriodStartUtc = now.AddHours(-4),
            PeriodEndUtc = now.AddHours(-3),
            CreditUsedRial = 40,
            Evidence = (int)AllocationOutcomeEvidence.Administrative,
            RecordedAtUtc = now.AddHours(-3)
        });
        learning.NeedLabels.Add(new()
        {
            Id = Guid.NewGuid(),
            SnapshotId = protectedByLabel,
            ReviewerAccountId = admin,
            NeedScore = .5m,
            RubricVersion = "legacy-retention-protection",
            Partition = (int)LearningPartition.Training,
            ReviewedAtUtc = now.AddHours(-3)
        });
        learning.Proposals.Add(new()
        {
            Id = Guid.NewGuid(),
            CreatedByAccountId = admin,
            CandidateVersion = "legacy-retention-proposal-" + Guid.NewGuid(),
            ModelVersion = "legacy-model",
            Rationale = "Existing historical proposal reference must block retention.",
            BaselineVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = "research-retention",
            SourceInstructionReference = "research-source",
            PoolRial = 100,
            WeightsJson = JsonSerializer.Serialize(AllocationWeightProfile.Baseline),
            SnapshotIdsJson = JsonSerializer.Serialize(new[] { protectedByProposal }),
            SimulationJson = "{}",
            CreatedAtUtc = now.AddHours(-3)
        });
        learning.TrainingRuns.Add(new()
        {
            Id = Guid.NewGuid(),
            RequestedByAccountId = admin,
            Status = "NO_IMPROVEMENT",
            DatasetVersion = "research-retention",
            ModelVersion = "legacy-model",
            InputsJson = JsonSerializer.Serialize(new
            {
                snapshotIds = new[] { protectedByTraining },
                labelIds = Array.Empty<Guid>(),
                poolRial = 100
            }),
            CutoffUtc = now.AddHours(-3),
            RecordedAtUtc = now.AddHours(-3)
        });
        await learning.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var service = new AllocationRetentionService(learning, roles, clock);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => service.PreviewAsync(ordinary, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(
            () => service.PreviewAsync(admin, now.AddMinutes(1)));

        var preview = await service.PreviewAsync(admin, cutoff);
        Assert.Equal(AllocationRetentionService.AttributedResearchScope, preview.Scope);
        Assert.Equal(2, preview.TotalEligibleSnapshotCount);
        Assert.Equal(2, preview.SelectedSnapshotCount);
        Assert.Equal(1, preview.SelectedOutcomeCount);
        Assert.False(preview.Truncated);
        Assert.Equal(64, preview.PreviewDigest.Length);

        await Assert.ThrowsAsync<AllocationRetentionConflictException>(
            () => service.PurgeAsync(
                Guid.NewGuid(),
                admin,
                cutoff,
                new string('0', 64),
                "Wrong preview must fail closed."));

        var requestId = Guid.NewGuid();
        const string purgeReason =
            "Approved deletion of expired attributed research records.";
        var result = await service.PurgeAsync(
            requestId,
            admin,
            cutoff,
            preview.PreviewDigest,
            purgeReason);

        Assert.Equal(2, result.DeletedSnapshotCount);
        Assert.Equal(1, result.DeletedOutcomeCount);
        learning.ChangeTracker.Clear();

        Assert.False(await learning.Assessments.AsNoTracking()
            .AnyAsync(x => x.Id == eligibleWithOutcome));
        Assert.False(await learning.Assessments.AsNoTracking()
            .AnyAsync(x => x.Id == eligibleWithoutOutcome));
        Assert.False(await learning.Outcomes.AsNoTracking()
            .AnyAsync(x => x.SnapshotId == eligibleWithOutcome));

        foreach (var protectedId in new[]
        {
            protectedByLabel,
            protectedByProposal,
            protectedByTraining,
            protectedByRuntime,
            firstParty,
            newerAttributed
        })
            Assert.True(await learning.Assessments.AsNoTracking()
                .AnyAsync(x => x.Id == protectedId));

        var audit = await learning.RetentionEvents.AsNoTracking()
            .SingleAsync(x => x.Id == result.EventId);
        Assert.Equal(admin, audit.ActorAccountId);
        Assert.Equal(AllocationRetentionService.AttributedResearchScope, audit.Scope);
        Assert.Equal(cutoff, audit.CutoffUtc);
        Assert.Equal(preview.PreviewDigest, audit.PreviewDigest);
        Assert.Equal(2, audit.DeletedSnapshotCount);
        Assert.Equal(1, audit.DeletedOutcomeCount);
        Assert.Contains("Approved deletion", audit.Reason);

        var replay = await service.PurgeAsync(
            requestId,
            admin,
            cutoff,
            preview.PreviewDigest,
            purgeReason);
        Assert.Equal(result, replay);
        Assert.Single(await learning.RetentionEvents.AsNoTracking()
            .Where(x => x.Id == requestId).ToListAsync());

        await Assert.ThrowsAsync<AllocationRetentionConflictException>(
            () => service.PurgeAsync(
                requestId,
                admin,
                cutoff,
                preview.PreviewDigest,
                "Changed reason must conflict with the original request."));

        var after = await service.PreviewAsync(admin, cutoff);
        Assert.Equal(0, after.TotalEligibleSnapshotCount);
        await Assert.ThrowsAsync<AllocationRetentionConflictException>(
            () => service.PurgeAsync(
                Guid.NewGuid(),
                admin,
                cutoff,
                preview.PreviewDigest,
                "Stale preview must not execute again."));
    }

    [Fact]
    public async Task ProposalServiceRejectsAttributedResearchSnapshots()
    {
        var root = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_retention_proposal_" + Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;
        await using var learning = Learning(connection);
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var snapshotId = Guid.NewGuid();
        learning.Assessments.Add(new()
        {
            Id = snapshotId,
            HouseholdKey = Guid.NewGuid(),
            RecordedByAccountId = Guid.NewGuid(),
            EvidenceReference = "manual-research-only",
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = "research-only",
            SourceInstructionReference = "research-source",
            GeographicFactor = 1m,
            Health = 1,
            Hardship = 1,
            Age = 1,
            Size = 1,
            Care = 1,
            Education = 1,
            AllocatedRial = 100,
            AssessedAtUtc = now.AddHours(-1),
            RecordedAtUtc = now
        });
        await learning.SaveChangesAsync();

        var service = new AllocationProposalService(
            learning, new FixedClock(now));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitAsync(
                Guid.NewGuid(),
                new AllocationWeightProfile(
                    "retention-reject-" + Guid.NewGuid(),
                    .30m, .25m, .15m, .10m, .10m, .10m),
                "manual-model",
                "Attributed research must never enter a production candidate.",
                new[] { snapshotId },
                100,
                "research-only",
                "research-source"));
    }

    private static HanaAllocationLearningDbContext Learning(string connection) => new(
        new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning"))
            .Options);

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
