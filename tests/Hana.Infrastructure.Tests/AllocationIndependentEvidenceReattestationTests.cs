using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationIndependentEvidenceReattestationTests
{
    [Fact]
    public async Task BothSourcesReattestIndependentlyAndDoNotAdmitLearning()
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
        var householdId = Guid.NewGuid();
        db.Assessments.Add(new()
        {
            Id = snapshotId, HouseholdKey = householdId,
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            RuntimeProfileSequence = 0,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:" + Guid.NewGuid(),
            GeographicFactor = 1.1m,
            Health = 1, Hardship = 2, Age = 1,
            Size = 1, Care = 0, Education = 1,
            AllocatedRial = 1000,
            AssessedAtUtc = clock.UtcNow.AddDays(-2),
            RecordedAtUtc = clock.UtcNow.AddDays(-2)
        });
        await db.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var writer = new AllocationReviewedSevenFactorService(db, roles, clock);
        var outcomeWriter = new AllocationReviewedOutcomeService(db, roles, clock);
        var featureId = Guid.NewGuid();
        var outcomeId = Guid.NewGuid();
        Assert.True(await writer.RecordAsync(reviewer,
            new AllocationReviewedSevenFactorInput(
                featureId, snapshotId, 1, 1, 1, 1, 0, 1,
                HouseholdHousingTenure.Tenant,
                "reviewed-tenure", "reviewed-non-housing-hardship",
                "reviewed-other-five-features")));
        Assert.True(await outcomeWriter.RecordAsync(reviewer,
            new AllocationReviewedOutcomeInput(
                outcomeId, snapshotId,
                clock.UtcNow.AddDays(-1), clock.UtcNow.AddHours(-1),
                0m, null, null, null, "reviewed-coverage")));

        var cutoff = clock.UtcNow;
        var featurePreview = await new AllocationSevenFactorReviewInventoryService(
            db, roles, clock).PreviewAsync(
                reviewer, new[] { featureId }, cutoff);
        var outcomePreview = await new AllocationEssentialNeedsCoverageInventoryService(
            db, roles, clock).PreviewAsync(
                reviewer, new[] { outcomeId }, cutoff);
        Assert.NotEqual(featurePreview.ManifestContractVersion,
            outcomePreview.ManifestContractVersion);
        Assert.NotEqual(featurePreview.Sha256, outcomePreview.Sha256);

        var reattestor = new AllocationIndependentEvidenceReattestationService(
            db, roles, clock);
        var features = await reattestor.ReattestSevenFactorAsync(
            reviewer, new[] { featureId }, cutoff,
            featurePreview.ManifestContractVersion, featurePreview.Sha256);
        var outcomes = await reattestor.ReattestCoverageAsync(
            reviewer, new[] { outcomeId }, cutoff,
            outcomePreview.ManifestContractVersion, outcomePreview.Sha256);
        Assert.True(features.Matches);
        Assert.True(outcomes.Matches);
        Assert.Equal(AllocationSevenFactorReviewInventoryService.NotAdmittedStatus,
            features.AdmissionStatus);
        Assert.Equal(AllocationEssentialNeedsCoverageInventoryService.NotAdmittedStatus,
            outcomes.AdmissionStatus);
        Assert.Equal(1, features.SelectedRecordCount);
        Assert.Equal(1, outcomes.SelectedRecordCount);

        // Valid digests cannot be swapped between independent objectives.
        Assert.False((await reattestor.ReattestSevenFactorAsync(
            reviewer, new[] { featureId }, cutoff,
            featurePreview.ManifestContractVersion, outcomePreview.Sha256)).Matches);
        Assert.False((await reattestor.ReattestCoverageAsync(
            reviewer, new[] { outcomeId }, cutoff,
            outcomePreview.ManifestContractVersion, featurePreview.Sha256)).Matches);

        // Changing the cutoff changes the canonical evidence identity.
        Assert.False((await reattestor.ReattestSevenFactorAsync(
            reviewer, new[] { featureId }, cutoff.AddTicks(-1),
            featurePreview.ManifestContractVersion, featurePreview.Sha256)).Matches);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            reattestor.ReattestSevenFactorAsync(reviewer, new[] { featureId },
                cutoff, outcomePreview.ManifestContractVersion,
                featurePreview.Sha256));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reattestor.ReattestCoverageAsync(reviewer, new[] { outcomeId },
                cutoff, outcomePreview.ManifestContractVersion, "not-sha256"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            reattestor.ReattestCoverageAsync(Guid.NewGuid(),
                new[] { outcomeId }, cutoff,
                outcomePreview.ManifestContractVersion, outcomePreview.Sha256));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            reattestor.ReattestSevenFactorAsync(reviewer,
                new[] { Guid.NewGuid() }, cutoff,
                featurePreview.ManifestContractVersion, featurePreview.Sha256));

        Assert.False(await db.NeedLabels.AsNoTracking()
            .AnyAsync(x => x.SnapshotId == snapshotId));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.RequestedByAccountId == reviewer));
    }
}
