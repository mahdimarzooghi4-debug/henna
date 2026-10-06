using System.Text.Json;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record AllocationTrainingLineage(
    Guid? RuntimeProposalId,
    long? RuntimeProfileSequence,
    AllocationWeightProfile Baseline);

public static class AllocationTrainingLineageResolver
{
    private const string SourcePrefix = "henna-program:";

    public static bool HasFirstPartyHennaProvenance(
        AllocationAssessmentRecord snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (snapshot.RecordedByAccountId is not null ||
            snapshot.EvidenceReference is not null ||
            snapshot.DatasetVersion != HennaAllocationLearningCapture.DatasetVersion ||
            !snapshot.SourceInstructionReference.StartsWith(
                SourcePrefix, StringComparison.Ordinal))
            return false;

        return Guid.TryParse(
                snapshot.SourceInstructionReference[SourcePrefix.Length..],
                out var programId) &&
            programId != Guid.Empty;
    }

    public static async Task<IReadOnlyDictionary<Guid, AllocationTrainingLineage>>
        ResolveEligibleAsync(
            HanaAllocationLearningDbContext db,
            IReadOnlyCollection<AllocationAssessmentRecord> snapshots,
            CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(snapshots);

        var result = new Dictionary<Guid, AllocationTrainingLineage>();
        if (snapshots.Count == 0) return result;

        var events = await db.RuntimeProfileEvents.AsNoTracking()
            .OrderBy(x => x.Sequence)
            .ToArrayAsync(ct);
        var proposalIds = snapshots
            .Where(x => x.RuntimeProposalId is not null)
            .Select(x => x.RuntimeProposalId!.Value)
            .Distinct()
            .ToArray();
        var proposals = proposalIds.Length == 0
            ? new Dictionary<Guid, AllocationProposalRecord>()
            : await db.Proposals.AsNoTracking()
                .Where(x => proposalIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, ct);

        foreach (var snapshot in snapshots)
        {
            if (!HasFirstPartyHennaProvenance(snapshot))
                continue;

            if (snapshot.RuntimeProfileSequence is null)
            {
                // Backward compatibility is intentionally narrow: only legacy
                // baseline rows recorded before the first runtime transition.
                if (snapshot.RuntimeProposalId is null &&
                    snapshot.FormulaVersion ==
                        AllocationWeightProfile.Baseline.Version &&
                    !events.Any(x =>
                        x.RecordedAtUtc <= snapshot.AssessedAtUtc))
                    result[snapshot.Id] = new(
                        null, null, AllocationWeightProfile.Baseline);
                continue;
            }

            if (snapshot.RuntimeProfileSequence == 0)
            {
                if (snapshot.RuntimeProposalId is null &&
                    snapshot.FormulaVersion ==
                        AllocationWeightProfile.Baseline.Version)
                    result[snapshot.Id] = new(
                        null, 0L, AllocationWeightProfile.Baseline);
                continue;
            }

            var runtimeEvent = events.SingleOrDefault(x =>
                x.Sequence == snapshot.RuntimeProfileSequence.Value);
            if (runtimeEvent is null ||
                runtimeEvent.RecordedAtUtc > snapshot.AssessedAtUtc ||
                runtimeEvent.EffectiveProposalId != snapshot.RuntimeProposalId ||
                runtimeEvent.EffectiveProfileVersion != snapshot.FormulaVersion)
                continue;

            var profile = DeserializeProfile(
                runtimeEvent.EffectiveWeightsJson,
                runtimeEvent.EffectiveProfileVersion);

            if (snapshot.RuntimeProposalId is null)
            {
                if (SameProfile(
                        profile, AllocationWeightProfile.Baseline))
                    result[snapshot.Id] = new(
                        null, runtimeEvent.Sequence, profile);
                continue;
            }

            if (!proposals.TryGetValue(
                    snapshot.RuntimeProposalId.Value, out var proposal) ||
                proposal.CandidateVersion != profile.Version)
                continue;

            var proposalProfile = DeserializeProfile(
                proposal.WeightsJson,
                proposal.CandidateVersion);
            if (!SameProfile(profile, proposalProfile))
                continue;

            var promoted = events.Any(x =>
                x.ProposalId == proposal.Id &&
                x.EventType == "RUNTIME_PROMOTED" &&
                x.EffectiveProposalId == proposal.Id &&
                x.EffectiveProfileVersion == profile.Version &&
                x.Sequence <= runtimeEvent.Sequence &&
                x.RecordedAtUtc <= snapshot.AssessedAtUtc);
            if (!promoted)
                continue;

            result[snapshot.Id] = new(
                proposal.Id, runtimeEvent.Sequence, profile);
        }

        return result;
    }

    private static AllocationWeightProfile DeserializeProfile(
        string json,
        string expectedVersion)
    {
        var profile = JsonSerializer.Deserialize<AllocationWeightProfile>(json)
            ?? throw new InvalidOperationException(
                "Allocation runtime lineage profile is invalid.");
        if (profile.Version != expectedVersion)
            throw new InvalidOperationException(
                "Allocation runtime lineage profile version is inconsistent.");
        return profile;
    }

    private static bool SameProfile(
        AllocationWeightProfile left,
        AllocationWeightProfile right) =>
        left.Version == right.Version &&
        left.Health == right.Health &&
        left.Hardship == right.Hardship &&
        left.Age == right.Age &&
        left.Size == right.Size &&
        left.Care == right.Care &&
        left.Education == right.Education;
}
