using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationProductionControlEventRecord
{
    public Guid Id { get; set; }
    public Guid ProposalId { get; set; }
    public Guid ActorAccountId { get; set; }
    public string EventType { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class AllocationProductionControlConflictException(string message)
    : Exception(message) { }

/// <summary>
/// Append-only authorization control plane for future production activation
/// and rollback. This service never applies coefficients to runtime.
/// </summary>
public sealed class AllocationProductionControlService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<Guid> AuthorizeActivationAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateReason(reason);

        if (!await db.Proposals.AsNoTracking().AnyAsync(
            x => x.Id == proposalId, ct))
            throw new ArgumentException("Proposal does not exist.");

        var review = await db.Reviews.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ProposalId == proposalId, ct);
        if (review?.Decision != "APPROVED")
            throw new AllocationProductionControlConflictException(
                "Production activation requires an approved proposal.");

        var pilotEvents = await db.PilotEvents.AsNoTracking()
            .Where(x => x.ProposalId == proposalId)
            .Select(x => x.EventType)
            .ToListAsync(ct);
        if (!pilotEvents.Contains("PILOT_COMPLETED"))
            throw new AllocationProductionControlConflictException(
                "Production activation requires a completed pilot.");
        if (pilotEvents.Contains("PILOT_ABORTED"))
            throw new AllocationProductionControlConflictException(
                "An aborted pilot cannot be activated.");

        if (await db.ProductionControlEvents.AsNoTracking().AnyAsync(
            x => x.ProposalId == proposalId &&
                 x.EventType == "PRODUCTION_ACTIVATION_AUTHORIZED", ct))
            throw new AllocationProductionControlConflictException(
                "Production activation has already been authorized.");

        return await AppendAsync(
            proposalId,
            actor,
            "PRODUCTION_ACTIVATION_AUTHORIZED",
            reason,
            ct);
    }

    public async Task<Guid> AuthorizeRollbackAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateReason(reason);

        var events = await db.ProductionControlEvents.AsNoTracking()
            .Where(x => x.ProposalId == proposalId)
            .Select(x => x.EventType)
            .ToListAsync(ct);

        if (!events.Contains("PRODUCTION_ACTIVATION_AUTHORIZED"))
            throw new AllocationProductionControlConflictException(
                "Rollback authorization requires prior activation authorization.");
        if (events.Contains("PRODUCTION_ROLLBACK_AUTHORIZED"))
            throw new AllocationProductionControlConflictException(
                "Rollback has already been authorized.");

        var latestRuntime = await db.RuntimeProfileEvents.AsNoTracking()
            .OrderByDescending(x => x.Sequence)
            .FirstOrDefaultAsync(ct);
        if (latestRuntime?.EffectiveProposalId != proposalId ||
            !await db.RuntimeProfileEvents.AsNoTracking().AnyAsync(
                x => x.ProposalId == proposalId &&
                     x.EventType == "RUNTIME_PROMOTED", ct))
            throw new AllocationProductionControlConflictException(
                "Rollback authorization requires the proposal to be the active runtime profile.");

        return await AppendAsync(
            proposalId,
            actor,
            "PRODUCTION_ROLLBACK_AUTHORIZED",
            reason,
            ct);
    }

    private async Task<Guid> AppendAsync(
        Guid proposalId,
        Guid actor,
        string eventType,
        string reason,
        CancellationToken ct)
    {
        var id = Guid.NewGuid();
        db.ProductionControlEvents.Add(new()
        {
            Id = id,
            ProposalId = proposalId,
            ActorAccountId = actor,
            EventType = eventType,
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
            throw new AllocationProductionControlConflictException(
                "Production control authorization already exists.");
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

    private static void ValidateReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000)
            throw new ArgumentException(
                "Production control reason must contain 1–2000 characters.");
    }
}
