using System.Text.Json;
using Hana.Domain.Credit;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.CreditLearning;

public sealed record AllocationTrainingLineage(
    Guid? RuntimeProposalId,
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

            var latest = events
                .Where(x => x.RecordedAtUtc <= snapshot.AssessedAtUtc)
                .OrderByDescending(x => x.Sequence)
                .FirstOrDefault();

            if (latest is null)
            {
                if (snapshot.RuntimeProposalId is null &&
                    snapshot.FormulaVersion ==
                        AllocationWeightProfile.Baseline.Version)
                    result[snapshot.Id] = new(
                        null, AllocationWeightProfile.Baseline);
                continue;
            }

            if (latest.EffectiveProposalId != snapshot.RuntimeProposalId ||
                latest.EffectiveProfileVersion != snapshot.FormulaVersion)
                continue;

            var profile = DeserializeProfile(
                latest.EffectiveWeightsJson,
                latest.EffectiveProfileVersion);

            if (snapshot.RuntimeProposalId is null)
            {
                if (profile.Version ==
                    AllocationWeightProfile.Baseline.Version)
                    result[snapshot.Id] = new(null, profile);
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
                x.Sequence <= latest.Sequence);
            if (!promoted)
                continue;

            result[snapshot.Id] = new(proposal.Id, profile);
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
