using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationPilotEventRecord
{
    public Guid Id { get; set; }
    public Guid ProposalId { get; set; }
    public Guid ActorAccountId { get; set; }
    public string EventType { get; set; } = "";
    public string? ScopeReference { get; set; }
    public string Reason { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class AllocationPilotConflictException(string message) : Exception(message) { }

/// <summary>
/// Append-only human-controlled pilot lifecycle. This service never changes
/// allocation weights, routes households, mutates wallets or activates production.
/// </summary>
public sealed class AllocationPilotService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<Guid> AuthorizeAsync(
        Guid proposalId,
        Guid actor,
        string scopeReference,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateText(scopeReference, 240, "Pilot scope reference");
        ValidateText(reason, 2000, "Pilot reason");

        var proposal = await db.Proposals.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == proposalId, ct);
        if (proposal is null)
            throw new ArgumentException("Proposal does not exist.");

        var review = await db.Reviews.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ProposalId == proposalId, ct);
        if (review?.Decision != "APPROVED")
            throw new AllocationPilotConflictException(
                "Only a human-approved proposal can enter pilot.");

        if (await db.PilotEvents.AsNoTracking().AnyAsync(
            x => x.ProposalId == proposalId, ct))
            throw new AllocationPilotConflictException(
                "Pilot lifecycle has already started for this proposal.");

        var id = Guid.NewGuid();
        db.PilotEvents.Add(new()
        {
            Id = id,
            ProposalId = proposalId,
            ActorAccountId = actor,
            EventType = "PILOT_AUTHORIZED",
            ScopeReference = scopeReference.Trim(),
            Reason = reason.Trim(),
            RecordedAtUtc = clock.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException { SqlState: "23505" })
        {
            throw new AllocationPilotConflictException(
                "Pilot lifecycle has already started for this proposal.");
        }

        return id;
    }

    public async Task<Guid> CompleteAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default) =>
        await FinishAsync(proposalId, actor, "PILOT_COMPLETED", reason, ct);

    public async Task<Guid> AbortAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default) =>
        await FinishAsync(proposalId, actor, "PILOT_ABORTED", reason, ct);

    private async Task<Guid> FinishAsync(
        Guid proposalId,
        Guid actor,
        string eventType,
        string reason,
        CancellationToken ct)
    {
        await RequireAdmin(actor, ct);
        ValidateText(reason, 2000, "Pilot reason");

        var events = await db.PilotEvents.AsNoTracking()
            .Where(x => x.ProposalId == proposalId)
            .OrderBy(x => x.RecordedAtUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);

        if (events.Count == 0 ||
            events[0].EventType != "PILOT_AUTHORIZED")
            throw new AllocationPilotConflictException(
                "Pilot must be explicitly authorized first.");
        if (events.Any(x => x.EventType is "PILOT_COMPLETED" or "PILOT_ABORTED"))
            throw new AllocationPilotConflictException(
                "Pilot has already reached a terminal state.");

        var id = Guid.NewGuid();
        db.PilotEvents.Add(new()
        {
            Id = id,
            ProposalId = proposalId,
            ActorAccountId = actor,
            EventType = eventType,
            ScopeReference = null,
            Reason = reason.Trim(),
            RecordedAtUtc = clock.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException { SqlState: "23505" })
        {
            throw new AllocationPilotConflictException(
                "Pilot has already reached a terminal state.");
        }

        return id;
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }

    private static void ValidateText(
        string value, int maximumLength, string field)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > maximumLength)
            throw new ArgumentException(
                $"{field} must contain 1–{maximumLength} characters.");
    }
}
