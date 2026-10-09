using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationEssentialNeedsCoverageInventoryTests
{
    [Fact]
    public async Task OnlyExplicitReviewedCoverageEntersIndependentReadOnlyEvidencePreview()
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(conn)) return;
        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(conn).Options);
        await using var db = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(conn, o => o.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var clock = new SystemClock();
        var admin = Guid.NewGuid();
        identity.Accounts.Add(new()
        {
            Id = admin,
            NormalizedPhone = "09" +
                RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
            CreatedAtUtc = clock.UtcNow
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = admin, Role = HanaRoles.Admin,
            GrantedAtUtc = clock.UtcNow
        });
        await identity.SaveChangesAsync();

        var program = "henna-program:" + Guid.NewGuid();
        var sources = new[] { Guid.NewGuid(), Guid.NewGuid() };
        foreach (var id in sources)
            db.Assessments.Add(new AllocationAssessmentRecord
            {
                Id = id, HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
                SourceInstructionReference = program, GeographicFactor = 1m,
                Health = 1, Hardship = 2, Age = 1, Size = 1, Care = 1, Education = 1,
                AllocatedRial = 1000,
                AssessedAtUtc = clock.UtcNow.AddDays(-2),
                RecordedAtUtc = clock.UtcNow.AddDays(-2)
            });
        await db.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var writer = new AllocationReviewedOutcomeService(db, roles, clock);
        var inventory = new AllocationEssentialNeedsCoverageInventoryService(
            db, roles, clock);
        var events = new[]
        {
            new AllocationReviewedOutcomeInput(
                Guid.NewGuid(), sources[0], clock.UtcNow.AddDays(-1),
                clock.UtcNow.AddHours(-1), 0m, null, null, null,
                "real-review-evidence-zero-coverage"),
            new AllocationReviewedOutcomeInput(
                Guid.NewGuid(), sources[1], clock.UtcNow.AddDays(-1),
                clock.UtcNow.AddHours(-1), .75m, false, null, null,
                "real-review-evidence-observed-coverage")
        };
        foreach (var input in events)
            Assert.True(await writer.RecordAsync(admin, input));
        var cutoff = clock.UtcNow;
        var ids = events.Select(e => e.EventId).ToArray();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            inventory.PreviewAsync(Guid.NewGuid(), ids, cutoff));

        var left = await inventory.PreviewAsync(admin, ids, cutoff);
        var right = await inventory.PreviewAsync(admin, ids.Reverse().ToArray(), cutoff);
        Assert.Equal(left.Sha256, right.Sha256);
        Assert.Equal(64, left.Sha256.Length);
        Assert.Equal(2, left.ReviewedCoverageObservationCount);
        Assert.Equal(program, left.SourceInstructionReference);
        Assert.Equal(AllocationEssentialNeedsCoverageInventoryService.NotAdmittedStatus,
            left.AdmissionStatus);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin, ids.Append(ids[0]).ToArray(), cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin, new[] { Guid.NewGuid() }, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin, ids, clock.UtcNow.AddDays(-1)));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin, ids, clock.UtcNow.AddDays(1)));

        // A human-reviewed StockBarrier observation with unknown coverage
        // must never be promoted to a numeric coverage result.
        var unknown = events[0] with
        {
            EventId = Guid.NewGuid(),
            EssentialNeedsCoverage = null,
            StockBarrier = false
        };
        Assert.True(await writer.RecordAsync(admin, unknown));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin, new[] { unknown.EventId }, clock.UtcNow));

        // No automatic latest-wins policy for two events on one snapshot.
        var conflict = events[0] with
        {
            EventId = Guid.NewGuid(),
            EvidenceReference = "second-independent-review"
        };
        Assert.True(await writer.RecordAsync(admin, conflict));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            inventory.PreviewAsync(admin,
                new[] { events[0].EventId, conflict.EventId }, clock.UtcNow));

        var separateDigest = await inventory.PreviewAsync(
            admin, new[] { conflict.EventId }, clock.UtcNow);
        var originalDigest = await inventory.PreviewAsync(
            admin, new[] { events[0].EventId }, clock.UtcNow);
        Assert.NotEqual(originalDigest.Sha256, separateDigest.Sha256);

        foreach (var snapshot in sources)
            Assert.False(await db.NeedLabels.AsNoTracking()
                .AnyAsync(x => x.SnapshotId == snapshot));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.RequestedByAccountId == admin));
    }
}
