using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.CreditLearning;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class HennaAllocationOutcomeCaptureTests
{
    [Fact]
    public async Task CreditBalanceRevisionsBecomeAdministrativeOutcomesIdempotently()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_outcome_capture_" + Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;

        await using var commerce = Commerce(connection);
        await using var learning = Learning(connection);
        await commerce.Database.MigrateAsync();
        await learning.Database.MigrateAsync();

        var now = new DateTimeOffset(
            2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        var snapshotId = Guid.NewGuid();
        var household = Guid.NewGuid();
        var account = Guid.NewGuid();
        var program = Guid.NewGuid();
        var category = Guid.NewGuid();

        learning.Assessments.Add(new()
        {
            Id = snapshotId,
            HouseholdKey = household,
            RecordedByAccountId = null,
            EvidenceReference = null,
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            RuntimeProposalId = null,
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
            AllocatedRial = 1_000,
            AssessedAtUtc = now.AddHours(-1),
            RecordedAtUtc = now.AddMinutes(-59)
        });
        commerce.Documents.Add(new()
        {
            Id = snapshotId,
            OwnerId = account,
            Kind = "CREDIT",
            Revision = 1,
            Body = JsonSerializer.Serialize(new CreditGrant(
                snapshotId, account, program, 1_000, 1_000,
                now.AddDays(10), [category], household))
        });
        await learning.SaveChangesAsync();
        await commerce.SaveChangesAsync();

        var capture = new HennaAllocationOutcomeCapture(
            commerce, learning, new FixedClock(now));

        Assert.Equal(0, await capture.CaptureCreditUsageAsync());
        Assert.Empty(await learning.Outcomes.AsNoTracking().ToListAsync());

        var credit = await commerce.Documents.SingleAsync(x => x.Id == snapshotId);
        credit.Body = JsonSerializer.Serialize(new CreditGrant(
            snapshotId, account, program, 1_000, 600,
            now.AddDays(10), [category], household));
        credit.Revision = 2;
        await commerce.SaveChangesAsync();

        Assert.Equal(1, await capture.CaptureCreditUsageAsync());
        Assert.Equal(0, await capture.CaptureCreditUsageAsync());

        learning.ChangeTracker.Clear();
        var first = Assert.Single(await learning.Outcomes.AsNoTracking()
            .Where(x => x.SnapshotId == snapshotId).ToListAsync());
        Assert.Equal(400m, first.CreditUsedRial);
        Assert.Equal((int)AllocationOutcomeEvidence.Administrative, first.Evidence);
        Assert.Null(first.EssentialNeedsCoverage);
        Assert.Null(first.StockBarrier);
        Assert.Null(first.DeliveryBarrier);
        Assert.Null(first.AccessBarrier);
        Assert.Equal(now.AddHours(-1), first.PeriodStartUtc);
        Assert.Equal(now, first.PeriodEndUtc);

        commerce.ChangeTracker.Clear();
        credit = await commerce.Documents.SingleAsync(x => x.Id == snapshotId);
        credit.Body = JsonSerializer.Serialize(new CreditGrant(
            snapshotId, account, program, 1_000, 1_000,
            now.AddDays(10), [category], household));
        credit.Revision = 3;
        await commerce.SaveChangesAsync();

        Assert.Equal(1, await capture.CaptureCreditUsageAsync());
        learning.ChangeTracker.Clear();
        var values = await learning.Outcomes.AsNoTracking()
            .Where(x => x.SnapshotId == snapshotId)
            .Select(x => x.CreditUsedRial)
            .ToListAsync();
        Assert.Equal(2, values.Count);
        Assert.Contains(400m, values);
        Assert.Contains(0m, values);
    }

    [Fact]
    public async Task ConcurrentOutcomeCaptureSerializesAndCorruptGrantFailsClosed()
    {
        var root = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(root)) return;

        var database = "henna_outcome_concurrent_" + Guid.NewGuid().ToString("N");
        await CreateDatabase(root, database);
        var connection = new NpgsqlConnectionStringBuilder(root)
        {
            Database = database
        }.ConnectionString;

        await using (var commerce = Commerce(connection))
        await using (var learning = Learning(connection))
        {
            await commerce.Database.MigrateAsync();
            await learning.Database.MigrateAsync();

            var now = new DateTimeOffset(
                2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
            var snapshotId = Guid.NewGuid();
            var household = Guid.NewGuid();
            var account = Guid.NewGuid();
            var program = Guid.NewGuid();
            var category = Guid.NewGuid();

            learning.Assessments.Add(new()
            {
                Id = snapshotId,
                HouseholdKey = household,
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
                SourceInstructionReference = "henna-program:" + program,
                GeographicFactor = 1m,
                AllocatedRial = 1_000,
                AssessedAtUtc = now.AddHours(-1),
                RecordedAtUtc = now.AddMinutes(-59)
            });
            commerce.Documents.Add(new()
            {
                Id = snapshotId,
                OwnerId = account,
                Kind = "CREDIT",
                Revision = 2,
                Body = JsonSerializer.Serialize(new CreditGrant(
                    snapshotId, account, program, 1_000, 750,
                    now.AddDays(10), [category], household))
            });
            await learning.SaveChangesAsync();
            await commerce.SaveChangesAsync();
        }

        var fixedNow = new DateTimeOffset(
            2026, 10, 6, 12, 0, 0, TimeSpan.Zero);
        await using var commerceA = Commerce(connection);
        await using var commerceB = Commerce(connection);
        await using var learningA = Learning(connection);
        await using var learningB = Learning(connection);

        var results = await Task.WhenAll(
            new HennaAllocationOutcomeCapture(
                commerceA, learningA, new FixedClock(fixedNow))
                .CaptureCreditUsageAsync(),
            new HennaAllocationOutcomeCapture(
                commerceB, learningB, new FixedClock(fixedNow))
                .CaptureCreditUsageAsync());

        Assert.Equal(1, results.Sum());

        await using var verify = Learning(connection);
        Assert.Single(await verify.Outcomes.AsNoTracking().ToListAsync());

        await using var corruptCommerce = Commerce(connection);
        var corrupt = await corruptCommerce.Documents.SingleAsync(
            x => x.Kind == "CREDIT");
        var stored = JsonSerializer.Deserialize<CreditGrant>(corrupt.Body)!;
        corrupt.Body = JsonSerializer.Serialize(stored with
        {
            GrantedRial = 999,
            AvailableRial = 700
        });
        corrupt.Revision = 3;
        await corruptCommerce.SaveChangesAsync();

        await using var commerceC = Commerce(connection);
        await using var learningC = Learning(connection);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new HennaAllocationOutcomeCapture(
                commerceC, learningC, new FixedClock(fixedNow))
                .CaptureCreditUsageAsync());
    }

    private static HanaCommerceDbContext Commerce(string connection) => new(
        new DbContextOptionsBuilder<HanaCommerceDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "commerce"))
            .Options);

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
