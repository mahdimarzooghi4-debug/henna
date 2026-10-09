using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationMutationConcurrencyTests
{
    [Fact]
    public async Task RollbackAuthorizationRechecksActiveRuntimeInsideSharedMutationLock()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database =
            "henna_allocation_mutation_" + Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;

        var now = new DateTimeOffset(
            2026, 10, 7, 11, 30, 0, TimeSpan.Zero);
        var admin = Guid.NewGuid();
        var firstProposal = Guid.NewGuid();
        var secondProposal = Guid.NewGuid();

        await using (var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options))
        await using (var learning = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory",
                        "allocation_learning"))
                .Options))
        {
            await identity.Database.MigrateAsync();
            await learning.Database.MigrateAsync();

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

            var firstProfile = new AllocationWeightProfile(
                "audit-runtime-p1",
                .35m, .20m, .18m, .12m, .10m, .05m);
            var secondProfile = new AllocationWeightProfile(
                "audit-runtime-p2",
                .34m, .21m, .18m, .12m, .10m, .05m);

            learning.Proposals.AddRange(
                Proposal(firstProposal, admin, firstProfile, now.AddMinutes(-20)),
                Proposal(secondProposal, admin, secondProfile, now.AddMinutes(-10)));
            learning.ProductionControlEvents.Add(new()
            {
                Id = Guid.NewGuid(),
                ProposalId = firstProposal,
                ActorAccountId = admin,
                EventType = "PRODUCTION_ACTIVATION_AUTHORIZED",
                Reason = "test activation authorization",
                RecordedAtUtc = now.AddMinutes(-8)
            });
            learning.RuntimeProfileEvents.Add(new()
            {
                Id = Guid.NewGuid(),
                ProposalId = firstProposal,
                ActorAccountId = admin,
                Sequence = 1,
                EventType = "RUNTIME_PROMOTED",
                EffectiveProposalId = firstProposal,
                EffectiveProfileVersion = firstProfile.Version,
                EffectiveWeightsJson = JsonSerializer.Serialize(firstProfile),
                PreviousProposalId = null,
                PreviousProfileVersion =
                    AllocationWeightProfile.Baseline.Version,
                PreviousWeightsJson = JsonSerializer.Serialize(
                    AllocationWeightProfile.Baseline),
                Reason = "first profile active",
                RecordedAtUtc = now.AddMinutes(-5)
            });
            await learning.SaveChangesAsync();
        }

        var serviceConnection = new NpgsqlConnectionStringBuilder(connection)
        {
            ApplicationName = "henna-rollback-authorizer-audit"
        }.ConnectionString;

        await using var identityForService = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options);
        await using var learningForService = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(serviceConnection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory",
                        "allocation_learning"))
                .Options);
        var clock = new FixedClock(now);
        var roles = new RoleAuthorizationService(
            identityForService,
            new AuthSessionService(identityForService, clock));
        var service = new AllocationProductionControlService(
            learningForService, roles, clock);

        await using var blocker = new NpgsqlConnection(connection);
        await blocker.OpenAsync();
        await using var blockerTx = await blocker.BeginTransactionAsync();
        await using (var lockCommand = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(48710261005)",
            blocker,
            blockerTx))
        {
            await lockCommand.ExecuteNonQueryAsync();
        }

        var authorizationTask = service.AuthorizeRollbackAsync(
            firstProposal,
            admin,
            "must be checked after runtime lock",
            CancellationToken.None);

        Assert.True(await WaitForAdvisoryWait(
            connection,
            "henna-rollback-authorizer-audit",
            TimeSpan.FromSeconds(10)));

        var secondProfileJson = JsonSerializer.Serialize(
            new AllocationWeightProfile(
                "audit-runtime-p2",
                .34m, .21m, .18m, .12m, .10m, .05m));
        var firstProfileJson = JsonSerializer.Serialize(
            new AllocationWeightProfile(
                "audit-runtime-p1",
                .35m, .20m, .18m, .12m, .10m, .05m));

        await using (var promoteSecond = new NpgsqlCommand(
            """
            INSERT INTO allocation_learning.runtime_profile_events
            ("Id","ProposalId","ActorAccountId","Sequence","EventType",
             "EffectiveProposalId","EffectiveProfileVersion",
             "EffectiveWeightsJson","PreviousProposalId",
             "PreviousProfileVersion","PreviousWeightsJson",
             "Reason","RecordedAtUtc")
            VALUES
            (@id,@proposal,@actor,2,'RUNTIME_PROMOTED',
             @proposal,'audit-runtime-p2',CAST(@effective AS jsonb),
             @previous,'audit-runtime-p1',CAST(@previousWeights AS jsonb),
             'concurrent second promotion',@recorded)
            """,
            blocker,
            blockerTx))
        {
            promoteSecond.Parameters.AddWithValue("id", Guid.NewGuid());
            promoteSecond.Parameters.AddWithValue("proposal", secondProposal);
            promoteSecond.Parameters.AddWithValue("actor", admin);
            promoteSecond.Parameters.AddWithValue("effective", secondProfileJson);
            promoteSecond.Parameters.AddWithValue("previous", firstProposal);
            promoteSecond.Parameters.AddWithValue(
                "previousWeights", firstProfileJson);
            promoteSecond.Parameters.AddWithValue(
                "recorded", now.AddMinutes(-1));
            await promoteSecond.ExecuteNonQueryAsync();
        }

        await blockerTx.CommitAsync();

        await Assert.ThrowsAsync<AllocationProductionControlConflictException>(
            async () => await authorizationTask);

        await using var verify = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory",
                        "allocation_learning"))
                .Options);
        Assert.False(await verify.ProductionControlEvents.AsNoTracking()
            .AnyAsync(x =>
                x.ProposalId == firstProposal &&
                x.EventType == "PRODUCTION_ROLLBACK_AUTHORIZED"));
        Assert.Equal(
            secondProposal,
            (await verify.RuntimeProfileEvents.AsNoTracking()
                .OrderByDescending(x => x.Sequence)
                .FirstAsync()).EffectiveProposalId);
    }

    private static AllocationProposalRecord Proposal(
        Guid id,
        Guid actor,
        AllocationWeightProfile profile,
        DateTimeOffset createdAtUtc) =>
        new()
        {
            Id = id,
            CreatedByAccountId = actor,
            CandidateVersion = profile.Version,
            ModelVersion = "audit-model-v1",
            Rationale = "mutation audit fixture",
            BaselineVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:audit",
            PoolRial = 1000,
            WeightsJson = JsonSerializer.Serialize(profile),
            SnapshotIdsJson = "[]",
            SimulationJson = "{}",
            CreatedAtUtc = createdAtUtc
        };

    private static async Task<bool> WaitForAdvisoryWait(
        string connection,
        string applicationName,
        TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        await using var observer = new NpgsqlConnection(connection);
        await observer.OpenAsync();
        while (DateTime.UtcNow < deadline)
        {
            await using var command = new NpgsqlCommand(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                      AND application_name = @application
                      AND wait_event_type = 'Lock'
                      AND wait_event = 'advisory'
                )
                """,
                observer);
            command.Parameters.AddWithValue("application", applicationName);
            if ((bool)(await command.ExecuteScalarAsync())!)
                return true;
            await Task.Delay(25);
        }
        return false;
    }

    private static async Task CreateDatabase(
        string root,
        string name)
    {
        await using var admin = new NpgsqlConnection(root);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand(
            "CREATE DATABASE " + name,
            admin);
        await create.ExecuteNonQueryAsync();
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow => now;
    }
}
