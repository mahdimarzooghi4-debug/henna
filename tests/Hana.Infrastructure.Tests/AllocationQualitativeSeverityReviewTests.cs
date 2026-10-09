using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationQualitativeSeverityReviewTests
{
    [Fact]
    public async Task HumanReviewedQualitativeSeverityIsImmutableAndNeverBecomesTraining()
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(conn)) return;
        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(conn).Options);
        await using var db = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>()
                .UseNpgsql(conn, x => x.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "allocation_learning")).Options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var clock = new SystemClock();
        var admin = Guid.NewGuid();
        identity.Accounts.Add(new()
        {
            Id = admin,
            NormalizedPhone = "09" + RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
            CreatedAtUtc = clock.UtcNow
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = admin, Role = HanaRoles.Admin, GrantedAtUtc = clock.UtcNow
        });
        await identity.SaveChangesAsync();
        var snapshot = Guid.NewGuid();
        var assessed = clock.UtcNow.AddDays(-1);
        db.Assessments.Add(new AllocationAssessmentRecord
        {
            Id = snapshot, HouseholdKey = Guid.NewGuid(),
            FormulaVersion = AllocationWeightProfile.Baseline.Version,
            RuntimeProfileSequence = 0,
            DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
            SourceInstructionReference = "henna-program:" + Guid.NewGuid(),
            GeographicFactor = 1m, Health = 1, Hardship = 2,
            Age = 1, Size = 1, Care = 0, Education = 1,
            AllocatedRial = 1000, AssessedAtUtc = assessed, RecordedAtUtc = assessed
        });
        await db.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var sevenId = Guid.NewGuid();
        var seven = new AllocationReviewedSevenFactorService(db, roles, clock);
        Assert.True(await seven.RecordAsync(admin,
            new AllocationReviewedSevenFactorInput(sevenId, snapshot,
                1, 1, 1, 1, 0, 1, HouseholdHousingTenure.Tenant,
                "housing-proof", "non-housing-hardship-proof", "remaining-features-proof")));

        var writer = new AllocationQualitativeSeverityReviewService(db, roles, clock);
        var review = new AllocationQualitativeSeverityReviewInput(
            Guid.NewGuid(), sevenId,
            NeedSeverityEvidenceDisposition.SufficientAndConsistent,
            ReviewedNeedSeverityLevel.High,
            ReviewedNeedSeverityQualitativeBasis.SeriousEssentialNeedConsequenceInNearTerm,
            "pre-allocation-reviewed-proof", assessed.AddHours(-1),
            "Human-reviewed serious near-term consequence of unmet essential need");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            writer.RecordAsync(Guid.NewGuid(), review));
        Assert.True(await writer.RecordAsync(admin, review));
        Assert.False(await writer.RecordAsync(admin, review));
        var stored = await db.QualitativeSeverityReviews.AsNoTracking()
            .SingleAsync(x => x.Id == review.Id);
        Assert.Equal(3, stored.SeverityLevel);
        Assert.Equal(3, stored.HumanSelectedBasis);
        Assert.Equal(ReviewedNeedSeverityQualitativeRubricV1.Version, stored.CriteriaVersion);
        Assert.Equal(snapshot, stored.SnapshotId);
        // ADR-067: one authorized Admin is sufficient as the human reviewer;
        // no second-reviewer identity or second-signature gate is invented.
        Assert.Equal(admin, stored.ReviewerAccountId);
        Assert.Equal(admin, (await db.ReviewedSevenFactorAssessments.AsNoTracking()
            .SingleAsync(x => x.Id == sevenId)).ReviewerAccountId);

        await Assert.ThrowsAsync<AllocationQualitativeSeverityReviewConflictException>(() =>
            writer.RecordAsync(admin, review with { Rationale = "changed reason" }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            writer.RecordAsync(admin, review with {
                Id = Guid.NewGuid(), EvidenceObservedAtUtc = assessed.AddSeconds(1)
            }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            writer.RecordAsync(admin, review with {
                Id = Guid.NewGuid(),
                HumanSelectedBasis = ReviewedNeedSeverityQualitativeBasis.ImmediateThreatToHealthSafetyOrVitalNeeds
            }));
        var abstained = review with {
            Id = Guid.NewGuid(),
            Disposition = NeedSeverityEvidenceDisposition.Conflicting,
            Level = null, HumanSelectedBasis = null,
            Rationale = "Two contradicting sources; human abstains"
        };
        Assert.True(await writer.RecordAsync(admin, abstained));
        Assert.Null((await db.QualitativeSeverityReviews.AsNoTracking()
            .SingleAsync(x => x.Id == abstained.Id)).SeverityLevel);
        await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE allocation_learning.qualitative_severity_reviews SET \"SeverityLevel\" = {4} WHERE \"Id\" = {review.Id}"));
        Assert.False(await db.NeedLabels.AsNoTracking()
            .AnyAsync(x => x.SnapshotId == snapshot));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.RequestedByAccountId == admin));
    }
}
