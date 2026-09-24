using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Organization;

public sealed record OrganizationAllocationProgramReadiness(
    Guid Id,
    string Name,
    string Status,
    string AllocationMethod,
    int InputRecordCount,
    int ReadyRecordCount,
    int NeedsReviewRecordCount,
    int ManualRecordCount,
    int ApiRecordCount);

public sealed record OrganizationAllocationReadiness(
    string OrganizationType,
    string DefaultAllocationMethod,
    int EligibleProgramCount,
    int InputRecordCount,
    int ReadyRecordCount,
    int NeedsReviewRecordCount,
    int ManualRecordCount,
    int ApiRecordCount,
    IReadOnlyList<OrganizationAllocationProgramReadiness> Programs);

public sealed class OrganizationAllocationReadinessService(
    HanaOrganizationDbContext db)
{
    private sealed record CountRow(
        Guid ProgramId,
        string MatchStatus,
        string Source,
        int Count);

    public async Task<OrganizationAllocationReadiness?> ResolveAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var organization = await db.Organizations
            .AsNoTracking()
            .Where(x => x.Id == organizationId && x.IsActive)
            .Select(x => new
            {
                x.OrganizationType,
                x.DefaultAllocationMethod
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (organization is null)
            return null;

        var programs = await db.Programs
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                (x.Status == OrganizationProgramStates.Registered ||
                 x.Status == OrganizationProgramStates.Active))
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Status,
                x.AllocationMethod
            })
            .ToListAsync(cancellationToken);

        var programIds = programs.Select(x => x.Id).ToArray();
        var counts = programIds.Length == 0
            ? []
            : await db.Recipients
                .AsNoTracking()
                .Where(x =>
                    x.OrganizationId == organizationId &&
                    programIds.Contains(x.ProgramId))
                .GroupBy(x => new
                {
                    x.ProgramId,
                    x.MatchStatus,
                    x.Source
                })
                .Select(group => new CountRow(
                    group.Key.ProgramId,
                    group.Key.MatchStatus,
                    group.Key.Source,
                    group.Count()))
                .ToListAsync(cancellationToken);

        var programResults = programs
            .Select(program =>
            {
                var rows = counts
                    .Where(x => x.ProgramId == program.Id)
                    .ToArray();
                var ready = rows
                    .Where(x =>
                        x.MatchStatus ==
                            OrganizationRecipientMatchStates.Matched)
                    .Sum(x => x.Count);
                var needsReview = rows
                    .Where(x =>
                        x.MatchStatus is
                            OrganizationRecipientMatchStates.NeedsMatch or
                            OrganizationRecipientMatchStates.PendingReview)
                    .Sum(x => x.Count);
                var manual = rows
                    .Where(x => x.Source == OrganizationRecipientSources.Manual)
                    .Sum(x => x.Count);
                var api = rows
                    .Where(x => x.Source == OrganizationRecipientSources.Api)
                    .Sum(x => x.Count);

                return new OrganizationAllocationProgramReadiness(
                    program.Id,
                    program.Name,
                    program.Status,
                    program.AllocationMethod,
                    rows.Sum(x => x.Count),
                    ready,
                    needsReview,
                    manual,
                    api);
            })
            .ToArray();

        return new OrganizationAllocationReadiness(
            organization.OrganizationType,
            organization.DefaultAllocationMethod,
            programResults.Length,
            programResults.Sum(x => x.InputRecordCount),
            programResults.Sum(x => x.ReadyRecordCount),
            programResults.Sum(x => x.NeedsReviewRecordCount),
            programResults.Sum(x => x.ManualRecordCount),
            programResults.Sum(x => x.ApiRecordCount),
            programResults);
    }

    public async Task<OrganizationAllocationProgramReadiness?>
        ResolveProgramAsync(
            Guid organizationId,
            Guid programId,
            CancellationToken cancellationToken = default)
    {
        var overview = await ResolveAsync(
            organizationId,
            cancellationToken);
        return overview?.Programs.SingleOrDefault(
            x => x.Id == programId);
    }
}
