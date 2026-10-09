using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationSevenFactorReviewInventoryTests
{
    [Fact]
    public async Task InventoryIsReadOnlyDeterministicAndFailsClosedOnMixedReviewLineage()
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
        var instruction = "henna-program:" + Guid.NewGuid();
        var assessmentIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        foreach (var id in assessmentIds)
        {
            db.Assessments.Add(new AllocationAssessmentRecord
            {
                Id = id, HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
                SourceInstructionReference = instruction,
                GeographicFactor = 1.2m, Health = 2, Hardship = 3,
                Age = 1, Size = 1, Care = 1, Education = 1,
                AllocatedRial = 10_000,
                AssessedAtUtc = clock.UtcNow.AddDays(-2),
                RecordedAtUtc = clock.UtcNow.AddDays(-2)
            });
        }
        await db.SaveChangesAsync();
        var auth = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var writer = new AllocationReviewedSevenFactorService(db, auth, clock);
        var reader = new AllocationSevenFactorReviewInventoryService(db, auth, clock);
        var reviews = assessmentIds.Select(id =>
            new AllocationReviewedSevenFactorInput(
                Guid.NewGuid(), id, 2, 1, 1, 1, 1, 1,
                HouseholdHousingTenure.Tenant,
                "evidence-housing", "evidence-non-housing",
                "evidence-other-five")).ToArray();
        foreach (var review in reviews)
            Assert.True(await writer.RecordAsync(admin, review));

        var cutoff = clock.UtcNow.AddMinutes(1).AddMinutes(-1);
        var ids = reviews.Select(x => x.ReviewId).ToArray();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            reader.PreviewAsync(Guid.NewGuid(), ids, cutoff));
        var a = await reader.PreviewAsync(admin, ids, cutoff);
        var b = await reader.PreviewAsync(admin, ids.Reverse().ToArray(), cutoff);
        Assert.Equal(a.Sha256, b.Sha256);
        Assert.Equal(64, a.Sha256.Length);
        Assert.Equal(2, a.ReviewedHouseholdCount);
        Assert.Equal(NeedsBasedAllocationV11.FormulaVersion, a.FormulaVersion);
        Assert.Equal(AllocationSevenFactorReviewInventoryService.NotAdmittedStatus,
            a.AdmissionStatus);
        Assert.Equal(instruction, a.SourceInstructionReference);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            reader.PreviewAsync(admin, ids.Append(ids[0]).ToArray(), cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reader.PreviewAsync(admin, new[] { Guid.NewGuid() }, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reader.PreviewAsync(admin, ids, clock.UtcNow.AddDays(-1)));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reader.PreviewAsync(admin, ids, clock.UtcNow.AddDays(1)));

        var correction = reviews[0] with
        {
            ReviewId = Guid.NewGuid(),
            HousingEvidenceReference = "new-evidence-housing"
        };
        Assert.True(await writer.RecordAsync(admin, correction));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reader.PreviewAsync(admin,
                new[] { reviews[0].ReviewId, correction.ReviewId }, clock.UtcNow));

        var corrected = await reader.PreviewAsync(
            admin, new[] { correction.ReviewId }, clock.UtcNow);
        var original = await reader.PreviewAsync(
            admin, new[] { reviews[0].ReviewId }, clock.UtcNow);
        Assert.NotEqual(original.Sha256, corrected.Sha256);

        // Read-only preflight must not write labels, training runs or
        // auto-promote anything on the basis of the SHA-256 digest.
        foreach (var snapshot in assessmentIds)
            Assert.False(await db.NeedLabels.AsNoTracking()
                .AnyAsync(x => x.SnapshotId == snapshot));
        Assert.False(await db.TrainingRuns.AsNoTracking().AnyAsync(
            x => x.RequestedByAccountId == admin));
    }
}
