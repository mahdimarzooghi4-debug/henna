using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationReviewedSevenFactorServiceTests
{
    [Fact]
    public async Task ReviewIsAppendOnlyAuthorizedFirstPartyBoundAndReplaySafe()
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(conn)) return;

        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(conn).Options);
        await using var db = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(conn, o => o.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var clock = new SystemClock();
        var reviewer = Guid.NewGuid();
        identity.Accounts.Add(new()
        {
            Id = reviewer,
            NormalizedPhone = "09" +
                RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
            CreatedAtUtc = clock.UtcNow
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = reviewer, Role = HanaRoles.Admin,
            GrantedAtUtc = clock.UtcNow
        });
        await identity.SaveChangesAsync();

        var snapshotId = Guid.NewGuid();
        db.Assessments.Add(new()
        {
            Id = snapshotId,
            HouseholdKey = Guid.NewGuid(),
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            RuntimeProfileSequence = 0,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:" + Guid.NewGuid(),
            GeographicFactor = 1.2m,
            Health = 2, Hardship = 3, Age = 1,
            Size = 1, Care = 2, Education = 1,
            AllocatedRial = 10_000,
            AssessedAtUtc = clock.UtcNow.AddDays(-1),
            RecordedAtUtc = clock.UtcNow
        });
        await db.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var service = new AllocationReviewedSevenFactorService(db, roles, clock);
        var input = new AllocationReviewedSevenFactorInput(
            Guid.NewGuid(), snapshotId,
            Health: 2, NonHousingHardship: 1, Age: 1,
            Size: 1, Care: 2, Education: 1,
            HousingTenure: HouseholdHousingTenure.Tenant,
            HousingEvidenceReference: "reviewed-housing-document",
            NonHousingHardshipEvidenceReference: "non-housing-financial-review",
            OtherNeedsEvidenceReference: "five-dimensions-reviewed-evidence");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.RecordAsync(Guid.NewGuid(), input));

        Assert.True(await service.RecordAsync(reviewer, input));
        Assert.False(await service.RecordAsync(reviewer, input));
        var stored = await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .SingleAsync(x => x.Id == input.ReviewId);
        Assert.Equal(NeedsBasedAllocationV11.FormulaVersion, stored.FormulaVersion);
        Assert.Equal(AllocationWeightProfile.Baseline.Version,
            stored.SourceFormulaVersion);
        Assert.Equal(HennaAllocationLearningCapture.DatasetVersion,
            stored.SourceDatasetVersion);
        Assert.Equal((int)HouseholdHousingTenure.Tenant, stored.HousingTenure);
        Assert.Equal(1, stored.NonHousingHardship);
        Assert.Equal(1.2m, stored.OriginalGeographicFactor);

        await Assert.ThrowsAsync<AllocationSevenFactorReviewConflictException>(() =>
            service.RecordAsync(reviewer, input with { NonHousingHardship = 2 }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RecordAsync(reviewer, input with {
                ReviewId = Guid.NewGuid(), HousingTenure = (HouseholdHousingTenure)0
            }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RecordAsync(reviewer, input with {
                ReviewId = Guid.NewGuid(), NonHousingHardshipEvidenceReference = ""
            }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RecordAsync(reviewer, input with {
                ReviewId = Guid.NewGuid(), SnapshotId = Guid.NewGuid()
            }));
        await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE allocation_learning.reviewed_seven_factor_assessments SET \"Health\" = {3} WHERE \"Id\" = {input.ReviewId}"));

        // The old six-feature training flow remains separate: no Reviewed Need
        // Label or TrainingRun is created by recording a v1.1 assessment.
        Assert.False(await db.NeedLabels.AsNoTracking()
            .AnyAsync(x => x.SnapshotId == snapshotId));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.DatasetVersion == HennaAllocationLearningCapture.DatasetVersion &&
                x.RequestedByAccountId == reviewer));
    }
}
