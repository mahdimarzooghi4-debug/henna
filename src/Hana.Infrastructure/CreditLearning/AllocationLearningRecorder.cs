using Hana.Application.Time;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationAssessmentIdempotencyConflictException()
    : Exception("Allocation assessment snapshot id was reused with different data.");

/// <summary>Internal writer; callers must supply an authorized frozen allocation result.</summary>
public sealed class AllocationLearningRecorder(HanaAllocationLearningDbContext db, IClock clock)
{
    public async Task RecordAssessmentAsync(Guid snapshotId, AllocationLearningCase assessment,
        string formulaVersion, string datasetVersion, string sourceInstructionReference,
        long allocatedRial, DateTimeOffset assessedAtUtc, CancellationToken cancellationToken = default,
        Guid? recordedByAccountId = null, string? evidenceReference = null)
    {
        var row = BuildAssessment(snapshotId, assessment, formulaVersion, datasetVersion,
            sourceInstructionReference, allocatedRial, assessedAtUtc,
            recordedByAccountId, evidenceReference);
        db.Assessments.Add(row);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> RecordAssessmentIdempotentlyAsync(
        Guid snapshotId,
        AllocationLearningCase assessment,
        string formulaVersion,
        string datasetVersion,
        string sourceInstructionReference,
        long allocatedRial,
        DateTimeOffset assessedAtUtc,
        CancellationToken cancellationToken = default,
        Guid? recordedByAccountId = null,
        string? evidenceReference = null)
    {
        var row = BuildAssessment(snapshotId, assessment, formulaVersion, datasetVersion,
            sourceInstructionReference, allocatedRial, assessedAtUtc,
            recordedByAccountId, evidenceReference);

        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
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
            """, cancellationToken);

        if (inserted == 1) return true;

        var stored = await db.Assessments.AsNoTracking()
            .SingleAsync(x => x.Id == row.Id, cancellationToken);
        if (!SameAssessment(stored, row))
            throw new AllocationAssessmentIdempotencyConflictException();
        return false;
    }

    private AllocationAssessmentRecord BuildAssessment(
        Guid snapshotId,
        AllocationLearningCase assessment,
        string formulaVersion,
        string datasetVersion,
        string sourceInstructionReference,
        long allocatedRial,
        DateTimeOffset assessedAtUtc,
        Guid? recordedByAccountId,
        string? evidenceReference)
    {
        ArgumentNullException.ThrowIfNull(assessment);
        ArgumentNullException.ThrowIfNull(assessment.Scores);
        foreach (var value in new[] { formulaVersion, datasetVersion, sourceInstructionReference })
            if (string.IsNullOrWhiteSpace(value) || value.Length > 120)
                throw new ArgumentException("Version and source references require 1–120 characters.");
        if ((recordedByAccountId is null) != (evidenceReference is null) ||
            recordedByAccountId == Guid.Empty || (evidenceReference is not null &&
                (string.IsNullOrWhiteSpace(evidenceReference) || evidenceReference.Length > 240)))
            throw new ArgumentException("Attributed snapshots require both recorder and evidence reference.");
        var now = clock.UtcNow;
        if (snapshotId == Guid.Empty || assessment.HouseholdKey == Guid.Empty ||
            assessment.GeographicFactor <= 0m || allocatedRial < 0 ||
            assessedAtUtc.Offset != TimeSpan.Zero || assessedAtUtc > now)
            throw new ArgumentException("A complete past UTC allocation snapshot is required.");
        var scores = assessment.Scores;
        // PostgreSQL timestamptz persists microseconds. Canonicalize before
        // both insert and replay comparison so an identical HTTP payload does
        // not conflict only because .NET retained a sub-microsecond tick.
        var persistedAssessedAtUtc = assessedAtUtc.AddTicks(
            -(assessedAtUtc.Ticks % 10));
        return new AllocationAssessmentRecord {
            Id = snapshotId, HouseholdKey = assessment.HouseholdKey,
            RecordedByAccountId = recordedByAccountId, EvidenceReference = evidenceReference?.Trim(),
            FormulaVersion = formulaVersion, DatasetVersion = datasetVersion,
            SourceInstructionReference = sourceInstructionReference,
            GeographicFactor = assessment.GeographicFactor, AllocatedRial = allocatedRial,
            Health = scores.Health, Hardship = scores.EconomicHardship,
            Age = scores.AgeAndDependency, Size = scores.HouseholdSize,
            Care = scores.CareAndSupport, Education = scores.Education,
            AssessedAtUtc = persistedAssessedAtUtc, RecordedAtUtc = now };
    }

    private static bool SameAssessment(
        AllocationAssessmentRecord stored,
        AllocationAssessmentRecord expected) =>
        stored.Id == expected.Id &&
        stored.HouseholdKey == expected.HouseholdKey &&
        stored.RecordedByAccountId == expected.RecordedByAccountId &&
        stored.EvidenceReference == expected.EvidenceReference &&
        stored.FormulaVersion == expected.FormulaVersion &&
        stored.DatasetVersion == expected.DatasetVersion &&
        stored.SourceInstructionReference == expected.SourceInstructionReference &&
        stored.GeographicFactor == expected.GeographicFactor &&
        stored.Health == expected.Health &&
        stored.Hardship == expected.Hardship &&
        stored.Age == expected.Age &&
        stored.Size == expected.Size &&
        stored.Care == expected.Care &&
        stored.Education == expected.Education &&
        stored.AllocatedRial == expected.AllocatedRial &&
        stored.AssessedAtUtc == expected.AssessedAtUtc;

    public async Task RecordOutcomeAsync(AllocationLearningObservation observation,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(observation);
        var snapshot = await db.Assessments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == observation.SnapshotId, cancellationToken)
            ?? throw new InvalidOperationException("Assessment snapshot does not exist.");
        var now = clock.UtcNow;
        if (observation.PeriodStartUtc < snapshot.AssessedAtUtc || observation.PeriodEndUtc > now)
            throw new ArgumentException("Observation must follow assessment and end in the past.");
        db.Outcomes.Add(new AllocationOutcomeRecord {
            Id = observation.EventId, SnapshotId = observation.SnapshotId,
            PeriodStartUtc = observation.PeriodStartUtc, PeriodEndUtc = observation.PeriodEndUtc,
            CreditUsedRial = observation.CreditUsedRial,
            EssentialNeedsCoverage = observation.EssentialNeedsCoverage,
            StockBarrier = observation.StockBarrier, DeliveryBarrier = observation.DeliveryBarrier,
            AccessBarrier = observation.AccessBarrier, Evidence = (int)observation.Evidence,
            RecordedAtUtc = now });
        await db.SaveChangesAsync(cancellationToken);
    }
}
