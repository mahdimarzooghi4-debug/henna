using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationRuntimeProfileEventRecord
{
    public Guid Id { get; set; }
    public Guid ProposalId { get; set; }
    public Guid ActorAccountId { get; set; }
    public long Sequence { get; set; }
    public string EventType { get; set; } = "";
    public Guid? EffectiveProposalId { get; set; }
    public string EffectiveProfileVersion { get; set; } = "";
    public string EffectiveWeightsJson { get; set; } = "";
    public Guid? PreviousProposalId { get; set; }
    public string PreviousProfileVersion { get; set; } = "";
    public string PreviousWeightsJson { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed record AllocationRuntimeProfileSnapshot(
    long Sequence,
    Guid? ProposalId,
    AllocationWeightProfile Profile);

public interface IAllocationRuntimeProfileProvider
{
    Task<AllocationRuntimeProfileSnapshot> CurrentAsync(
        CancellationToken ct = default);
}

public sealed class BaselineAllocationRuntimeProfileProvider
    : IAllocationRuntimeProfileProvider
{
    public Task<AllocationRuntimeProfileSnapshot> CurrentAsync(
        CancellationToken ct = default) =>
        Task.FromResult(new AllocationRuntimeProfileSnapshot(
            0L, null, AllocationWeightProfile.Baseline));
}

public sealed class AllocationRuntimeProfileProvider(
    HanaAllocationLearningDbContext db)
    : IAllocationRuntimeProfileProvider
{
    public async Task<AllocationRuntimeProfileSnapshot> CurrentAsync(
        CancellationToken ct = default)
    {
        var latest = await db.RuntimeProfileEvents.AsNoTracking()
            .OrderByDescending(x => x.Sequence)
            .FirstOrDefaultAsync(ct);

        if (latest is null)
            return new(0L, null, AllocationWeightProfile.Baseline);

        var profile = JsonSerializer.Deserialize<AllocationWeightProfile>(
            latest.EffectiveWeightsJson)
            ?? throw new InvalidOperationException(
                "Runtime allocation profile payload is invalid.");

        if (!string.Equals(
                profile.Version,
                latest.EffectiveProfileVersion,
                StringComparison.Ordinal))
            throw new InvalidOperationException(
                "Runtime allocation profile version does not match its frozen payload.");

        return new(latest.Sequence, latest.EffectiveProposalId, profile);
    }
}

public sealed class AllocationRuntimePromotionConflictException(string message)
    : Exception(message) { }

/// <summary>
/// Atomically changes the versioned allocation runtime profile only after the
/// separate human production-control authorization has been recorded.
/// Historical allocation journal rows are never rewritten.
/// </summary>
public sealed class AllocationRuntimePromotionService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<Guid> PromoteAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateReason(reason);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(
            "SELECT pg_advisory_xact_lock(48710261005)", ct);

        var proposal = await db.Proposals.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == proposalId, ct)
            ?? throw new ArgumentException("Proposal does not exist.");

        var controls = await db.ProductionControlEvents.AsNoTracking()
            .Where(x => x.ProposalId == proposalId)
            .Select(x => x.EventType)
            .ToListAsync(ct);
        if (!controls.Contains("PRODUCTION_ACTIVATION_AUTHORIZED"))
            throw new AllocationRuntimePromotionConflictException(
                "Runtime promotion requires explicit activation authorization.");
        if (controls.Contains("PRODUCTION_ROLLBACK_AUTHORIZED"))
            throw new AllocationRuntimePromotionConflictException(
                "Runtime promotion is blocked after rollback authorization.");

        if (await db.RuntimeProfileEvents.AsNoTracking().AnyAsync(
            x => x.ProposalId == proposalId &&
                 x.EventType == "RUNTIME_PROMOTED", ct))
            throw new AllocationRuntimePromotionConflictException(
                "Proposal has already been promoted.");

        var candidate = JsonSerializer.Deserialize<AllocationWeightProfile>(
            proposal.WeightsJson)
            ?? throw new InvalidOperationException(
                "Proposal weight payload is invalid.");
        if (!string.Equals(
                candidate.Version,
                proposal.CandidateVersion,
                StringComparison.Ordinal))
            throw new InvalidOperationException(
                "Proposal candidate version does not match its weight payload.");

        var current = await CurrentSnapshotAsync(ct);
        var sequence = await NextSequenceAsync(ct);
        var id = Guid.NewGuid();
        db.RuntimeProfileEvents.Add(new()
        {
            Id = id,
            ProposalId = proposalId,
            ActorAccountId = actor,
            Sequence = sequence,
            EventType = "RUNTIME_PROMOTED",
            EffectiveProposalId = proposalId,
            EffectiveProfileVersion = candidate.Version,
            EffectiveWeightsJson = JsonSerializer.Serialize(candidate),
            PreviousProposalId = current.ProposalId,
            PreviousProfileVersion = current.Profile.Version,
            PreviousWeightsJson = JsonSerializer.Serialize(current.Profile),
            Reason = reason.Trim(),
            RecordedAtUtc = clock.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException { SqlState: "23505" })
        {
            throw new AllocationRuntimePromotionConflictException(
                "Proposal runtime transition already exists.");
        }

        return id;
    }

    public async Task<Guid> RollbackAsync(
        Guid proposalId,
        Guid actor,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateReason(reason);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(
            "SELECT pg_advisory_xact_lock(48710261005)", ct);

        if (!await db.ProductionControlEvents.AsNoTracking().AnyAsync(
            x => x.ProposalId == proposalId &&
                 x.EventType == "PRODUCTION_ROLLBACK_AUTHORIZED", ct))
            throw new AllocationRuntimePromotionConflictException(
                "Runtime rollback requires explicit rollback authorization.");

        var promotion = await db.RuntimeProfileEvents.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.ProposalId == proposalId &&
                     x.EventType == "RUNTIME_PROMOTED", ct)
            ?? throw new AllocationRuntimePromotionConflictException(
                "Proposal has not been promoted.");

        if (await db.RuntimeProfileEvents.AsNoTracking().AnyAsync(
            x => x.ProposalId == proposalId &&
                 x.EventType == "RUNTIME_ROLLED_BACK", ct))
            throw new AllocationRuntimePromotionConflictException(
                "Proposal has already been rolled back.");

        var current = await CurrentSnapshotAsync(ct);
        if (current.ProposalId != proposalId)
            throw new AllocationRuntimePromotionConflictException(
                "Only the currently effective proposal can be rolled back.");

        var previous = JsonSerializer.Deserialize<AllocationWeightProfile>(
            promotion.PreviousWeightsJson)
            ?? throw new InvalidOperationException(
                "Frozen previous runtime profile is invalid.");
        if (!string.Equals(
                previous.Version,
                promotion.PreviousProfileVersion,
                StringComparison.Ordinal))
            throw new InvalidOperationException(
                "Frozen previous runtime profile version is inconsistent.");

        var sequence = await NextSequenceAsync(ct);
        var id = Guid.NewGuid();
        db.RuntimeProfileEvents.Add(new()
        {
            Id = id,
            ProposalId = proposalId,
            ActorAccountId = actor,
            Sequence = sequence,
            EventType = "RUNTIME_ROLLED_BACK",
            EffectiveProposalId = promotion.PreviousProposalId,
            EffectiveProfileVersion = previous.Version,
            EffectiveWeightsJson = JsonSerializer.Serialize(previous),
            PreviousProposalId = proposalId,
            PreviousProfileVersion = current.Profile.Version,
            PreviousWeightsJson = JsonSerializer.Serialize(current.Profile),
            Reason = reason.Trim(),
            RecordedAtUtc = clock.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException { SqlState: "23505" })
        {
            throw new AllocationRuntimePromotionConflictException(
                "Proposal runtime transition already exists.");
        }

        return id;
    }

    private async Task<long> NextSequenceAsync(CancellationToken ct)
    {
        var last = await db.RuntimeProfileEvents.AsNoTracking()
            .Select(x => (long?)x.Sequence)
            .MaxAsync(ct);
        return checked((last ?? 0L) + 1L);
    }

    private async Task<AllocationRuntimeProfileSnapshot> CurrentSnapshotAsync(
        CancellationToken ct)
    {
        var latest = await db.RuntimeProfileEvents.AsNoTracking()
            .OrderByDescending(x => x.Sequence)
            .FirstOrDefaultAsync(ct);

        if (latest is null)
            return new(0L, null, AllocationWeightProfile.Baseline);

        var profile = JsonSerializer.Deserialize<AllocationWeightProfile>(
            latest.EffectiveWeightsJson)
            ?? throw new InvalidOperationException(
                "Runtime allocation profile payload is invalid.");
        return new(latest.Sequence, latest.EffectiveProposalId, profile);
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
                "Runtime promotion reason must contain 1–2000 characters.");
    }
}
