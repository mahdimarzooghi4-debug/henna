using System.Security.Cryptography;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationSevenFactorPartitionPreflightTests
{
    [Fact]
    public async Task ExplicitPartitionsBindRealReviewedLineageAndNeverTrain()
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
        var actor = Guid.NewGuid();
        identity.Accounts.Add(new()
        {
            Id = actor,
            NormalizedPhone = "09" +
                RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
            CreatedAtUtc = clock.UtcNow
        });
        identity.RoleAssignments.Add(new()
        {
            AccountId = actor, Role = HanaRoles.Admin,
            GrantedAtUtc = clock.UtcNow
        });
        await identity.SaveChangesAsync();

        var ids = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var householdKeys = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var funding = "henna-program:" + Guid.NewGuid();
        var at = clock.UtcNow.AddDays(-2);
        for (int i = 0; i < ids.Length; i++)
            db.Assessments.Add(new AllocationAssessmentRecord
            {
                Id = ids[i], HouseholdKey = householdKeys[i],
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                RuntimeProfileSequence = 0,
                DatasetVersion = HennaAllocationLearningCapture.DatasetVersion,
                SourceInstructionReference = funding,
                GeographicFactor = 1m, Health = 2, Hardship = 2,
                Age = 1, Size = 1, Care = 0, Education = 1,
                AllocatedRial = 1000, AssessedAtUtc = at, RecordedAtUtc = at
            });
        await db.SaveChangesAsync();

        var roles = new RoleAuthorizationService(
            identity, new AuthSessionService(identity, clock));
        var factors = new AllocationReviewedSevenFactorService(db, roles, clock);
        var judgments = new AllocationQualitativeSeverityReviewService(db, roles, clock);
        var humanIds = new List<Guid>();
        for (int i = 0; i < ids.Length; i++)
        {
            var featureId = Guid.NewGuid();
            Assert.True(await factors.RecordAsync(actor, new(
                featureId, ids[i], 2, 1, 1, 1, 0, 1,
                HouseholdHousingTenure.Tenant, "tenure-source",
                "independent-non-housing-review", "five-dimensions-review")));
            var humanId = Guid.NewGuid();
            Assert.True(await judgments.RecordAsync(actor, new(
                humanId, featureId,
                NeedSeverityEvidenceDisposition.SufficientAndConsistent,
                ReviewedNeedSeverityLevel.Moderate,
                ReviewedNeedSeverityQualitativeBasis.DemonstrableDisruptionToEssentialNeeds,
                "verified-pre-allocation-evidence", at.AddHours(-1),
                "Human observed disruption to an essential need")));
            humanIds.Add(humanId);
        }

        var preview = new AllocationSevenFactorPartitionPreflightService(db, roles, clock);
        var cutoff = clock.UtcNow;
        var a = await preview.PreviewAsync(actor,
            new[] { humanIds[0] }, new[] { humanIds[1] }, new[] { humanIds[2] }, cutoff);
        var b = await preview.PreviewAsync(actor,
            new[] { humanIds[0] }, new[] { humanIds[1] }, new[] { humanIds[2] }, cutoff);
        Assert.Equal(a.Sha256, b.Sha256);
        Assert.Equal(64, a.Sha256.Length);
        Assert.Equal(1, a.TrainingCount);
        Assert.Equal(1, a.ValidationCount);
        Assert.Equal(1, a.EvaluationCount);
        Assert.Equal(AllocationSevenFactorPartitionPreflightService.NotAdmittedStatus,
            a.AdmissionStatus);
        Assert.Equal(funding, a.SourceInstructionReference);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            preview.PreviewAsync(Guid.NewGuid(),
                new[] { humanIds[0] }, new[] { humanIds[1] },
                new[] { humanIds[2] }, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            preview.PreviewAsync(actor, new[] { humanIds[0] },
                new[] { humanIds[0] }, new[] { humanIds[2] }, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            preview.PreviewAsync(actor, new[] { humanIds[0] },
                Array.Empty<Guid>(), new[] { humanIds[2] }, cutoff));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            preview.PreviewAsync(actor, new[] { humanIds[0] },
                new[] { humanIds[1] }, new[] { Guid.NewGuid() }, cutoff));

        var badReviewId = Guid.NewGuid();
        var sevenId = (await db.QualitativeSeverityReviews.AsNoTracking()
            .SingleAsync(x => x.Id == humanIds[0])).SevenFactorReviewId;
        Assert.True(await judgments.RecordAsync(actor, new(
            badReviewId, sevenId, NeedSeverityEvidenceDisposition.Conflicting,
            null, null, "conflicting-pre-allocation-evidence", at.AddHours(-1),
            "Human abstained due to contradictory evidence")));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            preview.PreviewAsync(actor, new[] { badReviewId },
                new[] { humanIds[1] }, new[] { humanIds[2] }, clock.UtcNow));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            preview.PreviewAsync(actor, new[] { humanIds[0], badReviewId },
                new[] { humanIds[1] }, new[] { humanIds[2] }, clock.UtcNow));

        // Training/evaluation provenance has been examined, not admitted:
        // the old six-feature labels and training artifacts stay untouched.
        Assert.False(await db.NeedLabels.AsNoTracking()
            .AnyAsync(x => ids.Contains(x.SnapshotId)));
        Assert.False(await db.TrainingRuns.AsNoTracking()
            .AnyAsync(x => x.RequestedByAccountId == actor));
    }
}
