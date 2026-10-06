using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Commerce;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Captures first-party administrative credit-usage observations from the
/// authoritative Henna commerce credit grant. This is telemetry only: usage
/// is never converted into a need label, eligibility decision or training
/// signal by this producer.
/// </summary>
public sealed class HennaAllocationOutcomeCapture(
    HanaCommerceDbContext commerce,
    HanaAllocationLearningDbContext learning,
    IClock clock)
{
    public async Task<int> CaptureCreditUsageAsync(
        int maximumSnapshots = 500,
        CancellationToken cancellationToken = default)
    {
        if (maximumSnapshots is < 1 or > 5000)
            throw new ArgumentOutOfRangeException(nameof(maximumSnapshots));

        await using var tx = await learning.Database.BeginTransactionAsync(
            cancellationToken);
        await learning.Database.ExecuteSqlRawAsync(
            "SELECT pg_advisory_xact_lock(48710261006)",
            cancellationToken);

        var snapshots = await learning.Assessments.AsNoTracking()
            .Where(x =>
                x.RecordedByAccountId == null &&
                x.EvidenceReference == null &&
                x.DatasetVersion == HennaAllocationLearningCapture.DatasetVersion &&
                x.SourceInstructionReference.StartsWith("henna-program:"))
            .OrderBy(x => x.RecordedAtUtc)
            .ThenBy(x => x.Id)
            .Take(maximumSnapshots)
            .ToListAsync(cancellationToken);

        if (snapshots.Count == 0)
        {
            await tx.CommitAsync(cancellationToken);
            return 0;
        }

        var ids = snapshots.Select(x => x.Id).ToArray();
        var creditDocuments = await commerce.Documents.AsNoTracking()
            .Where(x => x.Kind == "CREDIT" && ids.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var now = clock.UtcNow;
        if (now.Offset != TimeSpan.Zero)
            throw new InvalidOperationException(
                "Allocation outcome capture requires a UTC clock.");

        var inserted = 0;
        foreach (var snapshot in snapshots)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!creditDocuments.TryGetValue(snapshot.Id, out var document))
                continue;

            var grant = JsonSerializer.Deserialize<CreditGrant>(document.Body)
                ?? throw new InvalidOperationException(
                    "Henna credit grant payload is invalid.");

            if (grant.Id != snapshot.Id ||
                grant.HouseholdKey != snapshot.HouseholdKey ||
                grant.GrantedRial != snapshot.AllocatedRial ||
                grant.AvailableRial < 0 ||
                grant.AvailableRial > grant.GrantedRial)
                throw new InvalidOperationException(
                    "Henna credit grant does not match its allocation snapshot.");

            var usedRial = checked(grant.GrantedRial - grant.AvailableRial);
            // The initial untouched grant is already represented by the
            // allocation snapshot. Record only a later observed balance state.
            if (document.Revision <= 1 || usedRial == 0)
                continue;
            if (now <= snapshot.AssessedAtUtc)
                continue;

            var eventId = EventId(snapshot.Id, document.Revision);
            var row = new AllocationOutcomeRecord
            {
                Id = eventId,
                SnapshotId = snapshot.Id,
                PeriodStartUtc = snapshot.AssessedAtUtc,
                PeriodEndUtc = now,
                CreditUsedRial = usedRial,
                EssentialNeedsCoverage = null,
                StockBarrier = null,
                DeliveryBarrier = null,
                AccessBarrier = null,
                Evidence = (int)AllocationOutcomeEvidence.Administrative,
                RecordedAtUtc = now
            };

            var written = await learning.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO allocation_learning.outcomes
                ("Id","SnapshotId","PeriodStartUtc","PeriodEndUtc",
                 "CreditUsedRial","EssentialNeedsCoverage","StockBarrier",
                 "DeliveryBarrier","AccessBarrier","Evidence","RecordedAtUtc")
                VALUES
                ({row.Id},{row.SnapshotId},{row.PeriodStartUtc},{row.PeriodEndUtc},
                 {row.CreditUsedRial},{row.EssentialNeedsCoverage},{row.StockBarrier},
                 {row.DeliveryBarrier},{row.AccessBarrier},{row.Evidence},{row.RecordedAtUtc})
                ON CONFLICT ("Id") DO NOTHING
                """, cancellationToken);

            if (written == 0)
            {
                var stored = await learning.Outcomes.AsNoTracking()
                    .SingleAsync(x => x.Id == eventId, cancellationToken);
                if (stored.SnapshotId != row.SnapshotId ||
                    stored.CreditUsedRial != row.CreditUsedRial ||
                    stored.EssentialNeedsCoverage != null ||
                    stored.StockBarrier != null ||
                    stored.DeliveryBarrier != null ||
                    stored.AccessBarrier != null ||
                    stored.Evidence != row.Evidence)
                    throw new InvalidOperationException(
                        "Allocation outcome identity was reused with different first-party data.");
            }
            else
            {
                inserted++;
            }
        }

        await tx.CommitAsync(cancellationToken);
        return inserted;
    }

    internal static Guid EventId(Guid snapshotId, int revision)
    {
        if (snapshotId == Guid.Empty || revision < 1)
            throw new ArgumentException(
                "Snapshot and positive commerce revision are required.");
        var input = Encoding.UTF8.GetBytes(
            $"henna-credit-usage-v1|{snapshotId:D}|{revision}");
        var hash = SHA256.HashData(input);
        return new Guid(hash.AsSpan(0, 16));
    }
}
