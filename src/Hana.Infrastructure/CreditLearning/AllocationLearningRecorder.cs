using Hana.Application.Time;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

/// <summary>Internal writer; callers must supply an authorized frozen allocation result.</summary>
public sealed class AllocationLearningRecorder(HanaAllocationLearningDbContext db, IClock clock)
{
    public async Task RecordAssessmentAsync(Guid snapshotId, AllocationLearningCase assessment,
        string formulaVersion, string datasetVersion, string sourceInstructionReference,
        long allocatedRial, DateTimeOffset assessedAtUtc, CancellationToken cancellationToken = default,
        Guid? recordedByAccountId = null, string? evidenceReference = null)
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
        db.Assessments.Add(new AllocationAssessmentRecord {
            Id = snapshotId, HouseholdKey = assessment.HouseholdKey,
            RecordedByAccountId = recordedByAccountId, EvidenceReference = evidenceReference?.Trim(),
            FormulaVersion = formulaVersion, DatasetVersion = datasetVersion,
            SourceInstructionReference = sourceInstructionReference,
            GeographicFactor = assessment.GeographicFactor, AllocatedRial = allocatedRial,
            Health = scores.Health, Hardship = scores.EconomicHardship,
            Age = scores.AgeAndDependency, Size = scores.HouseholdSize,
            Care = scores.CareAndSupport, Education = scores.Education,
            AssessedAtUtc = assessedAtUtc, RecordedAtUtc = now });
        await db.SaveChangesAsync(cancellationToken);
    }

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
