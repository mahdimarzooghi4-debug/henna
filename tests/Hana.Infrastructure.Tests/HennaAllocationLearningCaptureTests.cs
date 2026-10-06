using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.CreditLearning;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class HennaAllocationLearningCaptureTests
{
    [Fact]
    public async Task CommerceAllocationJournalBecomesFirstPartyTrainingSnapshotWithoutApi()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        await using var commerce = new HanaCommerceDbContext(
            new DbContextOptionsBuilder<HanaCommerceDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "commerce"))
                .Options);
        await using var learning = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "allocation_learning"))
                .Options);

        var now = new DateTimeOffset(
            2026, 10, 5, 12, 0, 0, TimeSpan.Zero);
        var actor = Guid.NewGuid();
        var account = Guid.NewGuid();
        var household = Guid.NewGuid();
        var programId = Guid.NewGuid();
        var grantId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var category = Guid.NewGuid();

        var program = new CreditProgram(
            programId, "CI first-party", "reviewed-source-reference",
            10_000, 4_000, now.AddDays(30), [category], null);
        commerce.Documents.Add(new()
        {
            Id = programId,
            OwnerId = actor,
            Kind = "PROGRAM",
            Body = JsonSerializer.Serialize(program),
            Revision = 1
        });
        commerce.Journal.Add(new()
        {
            Id = eventId,
            ActorId = actor,
            CommandId = Guid.NewGuid(),
            ResourceId = Guid.NewGuid(),
            Event = "ALLOCATE_CREDIT",
            CreatedAtUtc = now.AddMinutes(-1),
            Body = JsonSerializer.Serialize(new
            {
                input = new
                {
                    programId,
                    poolRial = 6_000,
                    beneficiaries = new[]
                    {
                        new
                        {
                            accountId = account,
                            householdKey = household,
                            geographicFactor = 1.25m,
                            scores = new
                            {
                                health = 3,
                                hardship = 2,
                                age = 1,
                                size = 2,
                                care = 1,
                                education = 0
                            }
                        }
                    }
                },
                result = new
                {
                    grants = new[]
                    {
                        new CreditGrant(
                            grantId, account, programId, 6_000, 6_000,
                            now.AddDays(30), [category], household)
                    },
                    unallocatedRial = 0,
                    formulaVersion = AllocationWeightProfile.Baseline.Version
                }
            })
        });
        await commerce.SaveChangesAsync();

        var capture = new HennaAllocationLearningCapture(
            commerce, learning, new FixedClock(now));
        await capture.CapturePendingAsync();
        learning.ChangeTracker.Clear();

        var snapshot = await learning.Assessments.AsNoTracking()
            .SingleAsync(x => x.Id == grantId);
        Assert.Equal(household, snapshot.HouseholdKey);
        Assert.Null(snapshot.RecordedByAccountId);
        Assert.Null(snapshot.EvidenceReference);
        Assert.Equal(
            HennaAllocationLearningCapture.DatasetVersion,
            snapshot.DatasetVersion);
        Assert.Equal(
            "henna-program:" + programId,
            snapshot.SourceInstructionReference);
        Assert.Equal(AllocationWeightProfile.Baseline.Version,
            snapshot.FormulaVersion);
        Assert.Equal(1.25m, snapshot.GeographicFactor);
        Assert.Equal(3, snapshot.Health);
        Assert.Equal(2, snapshot.Hardship);
        Assert.Equal(6_000, snapshot.AllocatedRial);

        // Re-scanning the append-only journal is idempotent by grant/snapshot ID.
        await capture.CapturePendingAsync();
        Assert.Equal(1,
            await learning.Assessments.CountAsync(x => x.Id == grantId));

        // A promoted runtime formula remains first-party evidence and must be
        // captured, but it does not silently become training-eligible until
        // lineage-aware training explicitly supports that baseline.
        var promotedGrantId = Guid.NewGuid();
        var promotedHousehold = Guid.NewGuid();
        var promotedFormula = "henna-learned-ci-promoted";
        commerce.Journal.Add(new()
        {
            Id = Guid.NewGuid(),
            ActorId = actor,
            CommandId = Guid.NewGuid(),
            ResourceId = Guid.NewGuid(),
            Event = "ALLOCATE_CREDIT",
            CreatedAtUtc = now,
            Body = JsonSerializer.Serialize(new
            {
                input = new
                {
                    programId,
                    poolRial = 5_000,
                    beneficiaries = new[]
                    {
                        new
                        {
                            accountId = account,
                            householdKey = promotedHousehold,
                            geographicFactor = 1.1m,
                            scores = new
                            {
                                health = 2,
                                hardship = 3,
                                age = 1,
                                size = 1,
                                care = 0,
                                education = 1
                            }
                        }
                    }
                },
                result = new
                {
                    grants = new[]
                    {
                        new CreditGrant(
                            promotedGrantId, account, programId,
                            5_000, 5_000, now.AddDays(30),
                            [category], promotedHousehold)
                    },
                    unallocatedRial = 0,
                    formulaVersion = promotedFormula
                }
            })
        });
        await commerce.SaveChangesAsync();
        await capture.CapturePendingAsync();
        learning.ChangeTracker.Clear();

        var promotedSnapshot = await learning.Assessments.AsNoTracking()
            .SingleAsync(x => x.Id == promotedGrantId);
        Assert.Equal(promotedFormula, promotedSnapshot.FormulaVersion);
        var promotedLineage = await AllocationTrainingLineageResolver
            .ResolveEligibleAsync(learning, new[] { promotedSnapshot });
        Assert.Empty(promotedLineage);
    }

    [Fact]
    public async Task ConcurrentCaptureIsIdempotentAndConflictingSnapshotReuseFailsClosed()
    {
        var rootConnection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(rootConnection)) return;

        var database = "henna_learning_capture_" +
            Guid.NewGuid().ToString("N");
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

        static HanaCommerceDbContext Commerce(string value) => new(
            new DbContextOptionsBuilder<HanaCommerceDbContext>()
                .UseNpgsql(value, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "commerce"))
                .Options);
        static HanaAllocationLearningDbContext Learning(string value) => new(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(value, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "allocation_learning"))
                .Options);

        await using var seedCommerce = Commerce(connection);
        await using var seedLearning = Learning(connection);
        await seedCommerce.Database.MigrateAsync();
        await seedLearning.Database.MigrateAsync();

        var now = new DateTimeOffset(
            2026, 10, 6, 6, 0, 0, TimeSpan.Zero);
        var actor = Guid.NewGuid();
        var account = Guid.NewGuid();
        var household = Guid.NewGuid();
        var programId = Guid.NewGuid();
        var grantId = Guid.NewGuid();
        var category = Guid.NewGuid();

        seedCommerce.Documents.Add(new()
        {
            Id = programId,
            OwnerId = actor,
            Kind = "PROGRAM",
            Body = JsonSerializer.Serialize(new CreditProgram(
                programId, "Concurrent CI", "reviewed-concurrent-source",
                10_000, 4_000, now.AddDays(30), [category], null)),
            Revision = 1
        });
        seedCommerce.Journal.Add(new()
        {
            Id = Guid.NewGuid(),
            ActorId = actor,
            CommandId = Guid.NewGuid(),
            ResourceId = Guid.NewGuid(),
            Event = "ALLOCATE_CREDIT",
            CreatedAtUtc = now.AddMinutes(-1),
            Body = JsonSerializer.Serialize(new
            {
                input = new
                {
                    programId,
                    poolRial = 6_000,
                    beneficiaries = new[]
                    {
                        new
                        {
                            accountId = account,
                            householdKey = household,
                            geographicFactor = 1.25m,
                            scores = new
                            {
                                health = 3,
                                hardship = 2,
                                age = 1,
                                size = 2,
                                care = 1,
                                education = 0
                            }
                        }
                    }
                },
                result = new
                {
                    grants = new[]
                    {
                        new CreditGrant(
                            grantId, account, programId, 6_000, 6_000,
                            now.AddDays(30), [category], household)
                    },
                    unallocatedRial = 0,
                    formulaVersion = AllocationWeightProfile.Baseline.Version
                }
            })
        });
        await seedCommerce.SaveChangesAsync();

        await using var commerceA = Commerce(connection);
        await using var commerceB = Commerce(connection);
        await using var learningA = Learning(connection);
        await using var learningB = Learning(connection);
        var captured = await Task.WhenAll(
            new HennaAllocationLearningCapture(
                commerceA, learningA, new FixedClock(now))
                .CapturePendingAsync(),
            new HennaAllocationLearningCapture(
                commerceB, learningB, new FixedClock(now))
                .CapturePendingAsync());

        Assert.Equal(1, captured.Sum());
        seedLearning.ChangeTracker.Clear();
        Assert.Equal(1, await seedLearning.Assessments.AsNoTracking()
            .CountAsync(x => x.Id == grantId));

        // Reusing the same snapshot/grant ID with different first-party
        // contents is data corruption, not an idempotent replay.
        seedCommerce.Journal.Add(new()
        {
            Id = Guid.NewGuid(),
            ActorId = actor,
            CommandId = Guid.NewGuid(),
            ResourceId = Guid.NewGuid(),
            Event = "ALLOCATE_CREDIT",
            CreatedAtUtc = now,
            Body = JsonSerializer.Serialize(new
            {
                input = new
                {
                    programId,
                    poolRial = 5_999,
                    beneficiaries = new[]
                    {
                        new
                        {
                            accountId = account,
                            householdKey = household,
                            geographicFactor = 1.25m,
                            scores = new
                            {
                                health = 3,
                                hardship = 2,
                                age = 1,
                                size = 2,
                                care = 1,
                                education = 0
                            }
                        }
                    }
                },
                result = new
                {
                    grants = new[]
                    {
                        new CreditGrant(
                            grantId, account, programId, 5_999, 5_999,
                            now.AddDays(30), [category], household)
                    },
                    unallocatedRial = 0,
                    formulaVersion = AllocationWeightProfile.Baseline.Version
                }
            })
        });
        await seedCommerce.SaveChangesAsync();

        await using var commerceC = Commerce(connection);
        await using var learningC = Learning(connection);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new HennaAllocationLearningCapture(
                commerceC, learningC, new FixedClock(now))
                .CapturePendingAsync());
    }


    [Fact]
    public async Task PromotedRuntimeJournalCarriesVerifiedTrainingLineage()
    {
        var rootConnection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(rootConnection)) return;

        var database = "henna_promoted_capture_" +
            Guid.NewGuid().ToString("N");
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

        await using var commerce = new HanaCommerceDbContext(
            new DbContextOptionsBuilder<HanaCommerceDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "commerce"))
                .Options);
        await using var learning = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "allocation_learning"))
                .Options);
        await commerce.Database.MigrateAsync();
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(
            2026, 10, 6, 9, 0, 0, TimeSpan.Zero);
        var actor = Guid.NewGuid();
        var account = Guid.NewGuid();
        var household = Guid.NewGuid();
        var programId = Guid.NewGuid();
        var grantId = Guid.NewGuid();
        var category = Guid.NewGuid();
        var proposalId = Guid.NewGuid();
        var promoted = new AllocationWeightProfile(
            "henna-promoted-capture-" + Guid.NewGuid().ToString("N"),
            .35m, .20m, .18m, .12m, .10m, .05m);

        learning.Proposals.Add(new()
        {
            Id = proposalId,
            CreatedByAccountId = actor,
            CandidateVersion = promoted.Version,
            ModelVersion = "ci-promoted-parent",
            Rationale = "CI promoted parent.",
            BaselineVersion = AllocationWeightProfile.Baseline.Version,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:" + programId,
            PoolRial = 5000,
            WeightsJson = JsonSerializer.Serialize(promoted),
            SnapshotIdsJson = "[]",
            SimulationJson = "{}",
            CreatedAtUtc = now.AddHours(-2)
        });
        learning.RuntimeProfileEvents.Add(new()
        {
            Id = Guid.NewGuid(),
            ProposalId = proposalId,
            ActorAccountId = actor,
            Sequence = 1,
            EventType = "RUNTIME_PROMOTED",
            EffectiveProposalId = proposalId,
            EffectiveProfileVersion = promoted.Version,
            EffectiveWeightsJson = JsonSerializer.Serialize(promoted),
            PreviousProposalId = null,
            PreviousProfileVersion = AllocationWeightProfile.Baseline.Version,
            PreviousWeightsJson = JsonSerializer.Serialize(
                AllocationWeightProfile.Baseline),
            Reason = "CI runtime promotion.",
            RecordedAtUtc = now.AddHours(-1)
        });
        await learning.SaveChangesAsync();

        commerce.Documents.Add(new()
        {
            Id = programId,
            OwnerId = actor,
            Kind = "PROGRAM",
            Body = JsonSerializer.Serialize(new CreditProgram(
                programId, "CI promoted", "reviewed-promoted-source",
                10_000, 5_000, now.AddDays(30), [category], null)),
            Revision = 1
        });
        commerce.Journal.Add(new()
        {
            Id = Guid.NewGuid(),
            ActorId = actor,
            CommandId = Guid.NewGuid(),
            ResourceId = Guid.NewGuid(),
            Event = "ALLOCATE_CREDIT",
            CreatedAtUtc = now,
            Body = JsonSerializer.Serialize(new
            {
                input = new
                {
                    programId,
                    poolRial = 5_000,
                    beneficiaries = new[]
                    {
                        new
                        {
                            accountId = account,
                            householdKey = household,
                            geographicFactor = 1.1m,
                            scores = new
                            {
                                health = 3,
                                hardship = 1,
                                age = 1,
                                size = 1,
                                care = 0,
                                education = 0
                            }
                        }
                    }
                },
                result = new
                {
                    grants = new[]
                    {
                        new CreditGrant(
                            grantId, account, programId,
                            5_000, 5_000, now.AddDays(30),
                            [category], household)
                    },
                    unallocatedRial = 0,
                    formulaVersion = promoted.Version,
                    runtimeProposalId = proposalId,
                    runtimeProfileSequence = 1L
                }
            })
        });
        await commerce.SaveChangesAsync();

        var capture = new HennaAllocationLearningCapture(
            commerce, learning, new FixedClock(now));
        Assert.Equal(1, await capture.CapturePendingAsync());
        learning.ChangeTracker.Clear();

        var snapshot = await learning.Assessments.AsNoTracking()
            .SingleAsync(x => x.Id == grantId);
        Assert.Equal(promoted.Version, snapshot.FormulaVersion);
        Assert.Equal(proposalId, snapshot.RuntimeProposalId);
        Assert.Equal(1L, snapshot.RuntimeProfileSequence);

        var lineage = await AllocationTrainingLineageResolver
            .ResolveEligibleAsync(learning, new[] { snapshot });
        var resolved = Assert.Single(lineage);
        Assert.Equal(snapshot.Id, resolved.Key);
        Assert.Equal(proposalId, resolved.Value.RuntimeProposalId);
        Assert.Equal(1L, resolved.Value.RuntimeProfileSequence);
        Assert.Equal(promoted, resolved.Value.Baseline);
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow => now;
    }
}
