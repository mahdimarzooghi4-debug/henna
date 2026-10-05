using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.CreditLearning;
using Microsoft.EntityFrameworkCore;
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
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow => now;
    }
}
