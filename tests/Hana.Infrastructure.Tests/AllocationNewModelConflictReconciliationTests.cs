using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationNewModelConflictReconciliationTests
{
    [Fact]
    public async Task EquivalentNewModelReviewsCollapseButContradictionsAbstain()
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
            AccountId = admin, Role = HanaRoles.Admin, GrantedAtUtc = clock.UtcNow
        });
        await identity.SaveChangesAsync();

        var keys = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var snapshotIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var at = clock.UtcNow.AddDays(-1);
        for (int i = 0; i < keys.Length; i++)
            db.Assessments.Add(new()
            {
                Id = snapshotIds[i], HouseholdKey = keys[i],
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
                SourceInstructionReference = "henna-program:" + Guid.NewGuid(),
                GeographicFactor = 1m, Health = 1, Hardship = 2,
                Age = 1, Size = 1, Care = 1, Education = 1,
                AllocatedRial = 1000, AssessedAtUtc = at, RecordedAtUtc = at
            });
        await db.SaveChangesAsync();
        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var featureWriter = new AllocationReviewedSevenFactorService(db, roles, clock);
        var reviewWriter = new AllocationQualitativeSeverityReviewService(db, roles, clock);
        var resolver = new AllocationNewModelConflictReconciliationService(db, roles, clock);
        var cutoff = clock.UtcNow;

        // Household 0 has a real v1.1 judgment; household 1 currently has
        // only historical six-factor data; the latter is never invented as a
        // seven-feature zero-severity label.
        var featureId = Guid.NewGuid();
        Assert.True(await featureWriter.RecordAsync(admin, new(
            featureId, snapshotIds[0], 1, 1, 1, 1, 1, 1,
            HouseholdHousingTenure.Tenant, "tenure-proof",
            "nonhousing-proof", "other-five-proof")));
        var humanId = Guid.NewGuid();
        var review = new AllocationQualitativeSeverityReviewInput(
            humanId, featureId,
            NeedSeverityEvidenceDisposition.SufficientAndConsistent,
            ReviewedNeedSeverityLevel.High,
            ReviewedNeedSeverityQualitativeBasis.SeriousEssentialNeedConsequenceInNearTerm,
            "preallocation-proof", at.AddHours(-1),
            "Reviewed near-term impact");
        Assert.True(await reviewWriter.RecordAsync(admin, review));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            resolver.PreviewAsync(Guid.NewGuid(), keys, cutoff));
        var first = await resolver.PreviewAsync(admin, keys, cutoff);
        Assert.Equal(NewModelConflictDisposition.ConsistentSingle,
            first.Households.Single(x => x.HouseholdKey == keys[0]).Disposition);
        Assert.Equal(humanId,
            first.Households.Single(x => x.HouseholdKey == keys[0]).CanonicalReviewId);
        Assert.Equal(NewModelConflictDisposition.ExcludedNoNewModelReview,
            first.Households.Single(x => x.HouseholdKey == keys[1]).Disposition);
        Assert.Equal(64, first.Sha256.Length);
        Assert.Equal(AllocationNewModelConflictReconciliationService.NotAdmittedStatus,
            first.AdmissionStatus);

        // Repeated human review with exactly the same factual evidence is
        // reconciled without selecting the latest or inferring a new level.
        var duplicate = review with { Id = Guid.NewGuid() };
        Assert.True(await reviewWriter.RecordAsync(admin, duplicate));
        var equivalent = await resolver.PreviewAsync(admin,
            keys.Reverse().ToArray(), clock.UtcNow);
        Assert.Equal(NewModelConflictDisposition.EquivalentNewModelReviews,
            equivalent.Households.Single(x => x.HouseholdKey == keys[0]).Disposition);
        Assert.Equal(new[] { humanId, duplicate.Id }.Min(),
            equivalent.Households.Single(x => x.HouseholdKey == keys[0]).CanonicalReviewId);

        // New-model conflicting observations cause an ABSTENTION; the
        // resolver never picks a more recent or higher-scoring review.
        var conflicting = review with
        {
            Id = Guid.NewGuid(),
            Level = ReviewedNeedSeverityLevel.Critical,
            HumanSelectedBasis = ReviewedNeedSeverityQualitativeBasis.ImmediateThreatToHealthSafetyOrVitalNeeds,
            Rationale = "Contradictory reviewed need severity"
        };
        Assert.True(await reviewWriter.RecordAsync(admin, conflicting));
        var conflict = await resolver.PreviewAsync(admin, keys, clock.UtcNow);
        var selected = conflict.Households.Single(x => x.HouseholdKey == keys[0]);
        Assert.Equal(NewModelConflictDisposition.AbstainedConflictingEvidence,
            selected.Disposition);
        Assert.Null(selected.CanonicalReviewId);

        // An unreviewed v1.1 feature is also not silently treated as complete.
        var unmatched = Guid.NewGuid();
        Assert.True(await featureWriter.RecordAsync(admin, new(
            unmatched, snapshotIds[2], 1, 1, 1, 1, 1, 1,
            HouseholdHousingTenure.Owner, "housing-source",
            "financial-source", "five-features-source")));
        var incomplete = await resolver.PreviewAsync(admin, keys, clock.UtcNow);
        Assert.Equal(NewModelConflictDisposition.AbstainedIncomplete,
            incomplete.Households.Single(x => x.HouseholdKey == keys[2]).Disposition);
        Assert.NotEqual(first.Sha256, conflict.Sha256);
        Assert.True(incomplete.Households.All(x =>
            x.Disposition is NewModelConflictDisposition.AbstainedIncomplete
                or NewModelConflictDisposition.AbstainedConflictingEvidence
                or NewModelConflictDisposition.ExcludedNoNewModelReview));

        Assert.False(await db.NeedLabels.AsNoTracking()
            .AnyAsync(x => snapshotIds.Contains(x.SnapshotId)));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.RequestedByAccountId == admin));
    }
}
