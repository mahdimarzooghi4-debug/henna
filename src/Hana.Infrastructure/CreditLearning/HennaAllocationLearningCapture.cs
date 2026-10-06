using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Commerce;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>
/// Direct first-party capture from Henna's append-only commerce journal.
/// No HTTP, model API, provider SDK or imported assessment is involved.
/// </summary>
public sealed class HennaAllocationLearningCapture(
    HanaCommerceDbContext commerce,
    HanaAllocationLearningDbContext learning,
    IClock clock)
{
    public const string DatasetVersion = "henna-commerce-allocation-v1";

    public async Task<int> CapturePendingAsync(
        int maximumNewEvents = 500,
        CancellationToken cancellationToken = default)
    {
        if (maximumNewEvents is < 1 or > 5000)
            throw new ArgumentOutOfRangeException(nameof(maximumNewEvents));

        var added = 0;
        var scanned = 0;
        const int pageSize = 200;

        while (added < maximumNewEvents)
        {
            var events = await commerce.Journal.AsNoTracking()
                .Where(x => x.Event == "ALLOCATE_CREDIT")
                .OrderBy(x => x.CreatedAtUtc)
                .ThenBy(x => x.Id)
                .Skip(scanned)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
            if (events.Count == 0) break;
            scanned += events.Count;

            foreach (var journal in events)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var rows = await BuildRowsAsync(journal, cancellationToken);
                if (rows.Count == 0) continue;

                var ids = rows.Select(x => x.Id).ToArray();
                var existing = await learning.Assessments.AsNoTracking()
                    .Where(x => ids.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToArrayAsync(cancellationToken);
                var existingSet = existing.ToHashSet();
                var pending = rows.Where(x => !existingSet.Contains(x.Id)).ToArray();
                if (pending.Length == 0) continue;

                foreach (var row in pending)
                {
                    var inserted = await learning.Database.ExecuteSqlInterpolatedAsync(
                        $"""
                        INSERT INTO allocation_learning.assessments
                        ("Id","HouseholdKey","RecordedByAccountId","EvidenceReference",
                         "FormulaVersion","DatasetVersion","SourceInstructionReference",
                         "GeographicFactor","Health","Hardship","Age","Size","Care",
                         "Education","AllocatedRial","AssessedAtUtc","RecordedAtUtc")
                        VALUES
                        ({row.Id},{row.HouseholdKey},{row.RecordedByAccountId},
                         {row.EvidenceReference},{row.FormulaVersion},{row.DatasetVersion},
                         {row.SourceInstructionReference},{row.GeographicFactor},
                         {row.Health},{row.Hardship},{row.Age},{row.Size},{row.Care},
                         {row.Education},{row.AllocatedRial},{row.AssessedAtUtc},
                         {row.RecordedAtUtc})
                        ON CONFLICT ("Id") DO NOTHING
                        """,
                        cancellationToken);
                    added = checked(added + inserted);
                    if (added >= maximumNewEvents) break;
                }
                if (added >= maximumNewEvents) break;
            }
        }

        return added;
    }

    private async Task<List<AllocationAssessmentRecord>> BuildRowsAsync(
        CommerceJournal journal,
        CancellationToken ct)
    {
        using var payload = JsonDocument.Parse(journal.Body);
        var root = payload.RootElement;
        var input = root.GetProperty("input");
        var result = root.GetProperty("result");
        var programId = input.GetProperty("programId").GetGuid();

        var programDocument = await commerce.Documents.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == programId && x.Kind == "PROGRAM", ct)
            ?? throw new InvalidOperationException(
                "Henna allocation program referenced by journal is missing.");
        var program = JsonSerializer.Deserialize<CreditProgram>(
            programDocument.Body)
            ?? throw new InvalidOperationException(
                "Henna allocation program is invalid.");

        var beneficiaries = input.GetProperty("beneficiaries")
            .EnumerateArray()
            .Select(value => ParseBeneficiary(value))
            .ToDictionary(
                x => (x.AccountId, x.HouseholdKey),
                x => x);

        var rows = new List<AllocationAssessmentRecord>();
        foreach (var grantJson in result.GetProperty("grants").EnumerateArray())
        {
            var snapshotId = grantJson.GetProperty("Id").GetGuid();
            var accountId = grantJson.GetProperty("AccountId").GetGuid();
            var household = grantJson.GetProperty("HouseholdKey").GetGuid();
            var allocatedRial = grantJson.GetProperty("GrantedRial").GetInt64();

            if (!beneficiaries.TryGetValue(
                    (accountId, household), out var beneficiary))
                throw new InvalidOperationException(
                    "Allocation journal grant does not match its Henna input.");

            rows.Add(new AllocationAssessmentRecord
            {
                Id = snapshotId,
                HouseholdKey = household,
                // Null provenance is intentional and means first-party system
                // capture. Attributed/manual intake is never training-eligible.
                RecordedByAccountId = null,
                EvidenceReference = null,
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                DatasetVersion = DatasetVersion,
                SourceInstructionReference = "henna-program:" + program.Id,
                GeographicFactor = beneficiary.GeographicFactor,
                Health = beneficiary.Scores.Health,
                Hardship = beneficiary.Scores.EconomicHardship,
                Age = beneficiary.Scores.AgeAndDependency,
                Size = beneficiary.Scores.HouseholdSize,
                Care = beneficiary.Scores.CareAndSupport,
                Education = beneficiary.Scores.Education,
                AllocatedRial = allocatedRial,
                AssessedAtUtc = journal.CreatedAtUtc,
                RecordedAtUtc = clock.UtcNow
            });
        }

        return rows;
    }

    private static CapturedBeneficiary ParseBeneficiary(JsonElement value)
    {
        var scores = value.GetProperty("scores");
        return new(
            value.GetProperty("accountId").GetGuid(),
            value.GetProperty("householdKey").GetGuid(),
            value.GetProperty("geographicFactor").GetDecimal(),
            new HouseholdNeedScores(
                scores.GetProperty("health").GetInt32(),
                scores.GetProperty("hardship").GetInt32(),
                scores.GetProperty("age").GetInt32(),
                scores.GetProperty("size").GetInt32(),
                scores.GetProperty("care").GetInt32(),
                scores.GetProperty("education").GetInt32()));
    }

    private sealed record CapturedBeneficiary(
        Guid AccountId,
        Guid HouseholdKey,
        decimal GeographicFactor,
        HouseholdNeedScores Scores);
}
