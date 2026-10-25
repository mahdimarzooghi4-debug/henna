using System.Text.Json;
using Hana.Application.Time;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.External;

public sealed class MonoSellerBranchMapping
{
    public Guid SellerId { get; set; }
    public string MonoBranchId { get; set; } = "";
    public int Revision { get; set; }
    public Guid UpdatedByAccountId { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed record MonoSellerBranchMappingSnapshot(
    Guid SellerId, string MonoBranchId, int Revision,
    Guid UpdatedByAccountId, DateTimeOffset UpdatedAtUtc);

/// <summary>
/// An explicit admin assignment. The chosen branch must be returned as ACTIVE
/// by the authenticated Mono customer API; seller eligibility is checked locally.
/// </summary>
public sealed class MonoSellerBranchMappingService(
    HanaCommerceDbContext commerce,
    HanaSellerDbContext sellers,
    IMonoLogisticsClient mono,
    IClock clock)
{
    public async Task<MonoSellerBranchMappingSnapshot> SetAsync(
        Guid sellerId, string branchId, Guid actorId, int expectedRevision,
        CancellationToken cancellationToken = default)
    {
        if (sellerId == Guid.Empty || actorId == Guid.Empty || expectedRevision < 0
            || !MonoIds.IsBranchId(branchId))
            throw new MonoSellerBranchMappingException("INVALID_MAPPING");

        if (!await sellers.SellerActivations.AsNoTracking()
                .AnyAsync(item => item.ApplicationAccountId == sellerId, cancellationToken)
            || await sellers.SellerSuspensions.AsNoTracking().AnyAsync(item =>
                item.ApplicationAccountId == sellerId && item.RestoredAtUtc == null,
                cancellationToken))
            throw new MonoSellerBranchMappingException("SELLER_NOT_ACTIVE");

        var branches = await mono.ListBranchesAsync(cancellationToken);
        if (!branches.Branches.Any(item => item.BranchId == branchId && item.Status == "ACTIVE"))
            throw new MonoSellerBranchMappingException("MONO_BRANCH_NOT_ACTIVE_OR_NOT_OWNED");

        await using var transaction = await commerce.Database.BeginTransactionAsync(cancellationToken);
        var lockKey = "mono-seller-branch:" + sellerId.ToString("N");
        await commerce.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))", cancellationToken);

        var current = await commerce.MonoSellerBranchMappings.SingleOrDefaultAsync(
            item => item.SellerId == sellerId, cancellationToken);
        if (current is not null && current.MonoBranchId == branchId)
        {
            await transaction.CommitAsync(cancellationToken);
            return Snapshot(current);
        }
        if ((current?.Revision ?? 0) != expectedRevision)
            throw new MonoSellerBranchMappingException("MAPPING_REVISION_CONFLICT");

        var now = clock.UtcNow;
        var nextRevision = expectedRevision + 1;
        if (current is null)
        {
            current = new MonoSellerBranchMapping
            {
                SellerId = sellerId,
                MonoBranchId = branchId,
                Revision = nextRevision,
                UpdatedByAccountId = actorId,
                UpdatedAtUtc = now
            };
            commerce.MonoSellerBranchMappings.Add(current);
        }
        else
        {
            current.MonoBranchId = branchId;
            current.Revision = nextRevision;
            current.UpdatedByAccountId = actorId;
            current.UpdatedAtUtc = now;
        }

        commerce.Journal.Add(new CommerceJournal
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            CommandId = Guid.NewGuid(),
            ResourceId = sellerId,
            Event = "MONO_SELLER_BRANCH_MAPPED",
            Body = JsonSerializer.Serialize(new
            {
                sellerId,
                monoBranchId = branchId,
                revision = nextRevision
            }),
            CreatedAtUtc = now
        });
        await commerce.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Snapshot(current);
    }

    public async Task<MonoSellerBranchMappingSnapshot?> FindAsync(
        Guid sellerId, CancellationToken cancellationToken = default)
    {
        if (sellerId == Guid.Empty) return null;
        var current = await commerce.MonoSellerBranchMappings.AsNoTracking()
            .SingleOrDefaultAsync(item => item.SellerId == sellerId, cancellationToken);
        return current is null ? null : Snapshot(current);
    }

    private static MonoSellerBranchMappingSnapshot Snapshot(MonoSellerBranchMapping item) =>
        new(item.SellerId, item.MonoBranchId, item.Revision,
            item.UpdatedByAccountId, item.UpdatedAtUtc);
}

public sealed class MonoSellerBranchMappingException(string code)
    : Exception("Mono seller branch mapping could not be applied.")
{
    public string Code { get; } = code;
}
