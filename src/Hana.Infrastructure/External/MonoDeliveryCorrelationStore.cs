using System.Text.Json;
using Hana.Application.Time;
using Hana.Infrastructure.Commerce;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.External;

public static class MonoDeliveryCorrelationStates
{
    public const string Prepared = "PREPARED";
    public const string RequestReceived = "REQUEST_RECEIVED";
    public const string MissionLinked = "MISSION_LINKED";
}

public sealed class MonoDeliveryCorrelation
{
    public Guid OrderId { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public string State { get; set; } = MonoDeliveryCorrelationStates.Prepared;
    public string? DeliveryRequestId { get; set; }
    public string? MissionId { get; set; }
    public string? RequestFingerprint { get; set; }
    public DateTimeOffset PreparedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public int Revision { get; set; }
}

public sealed record MonoDeliveryCorrelationSnapshot(
    Guid OrderId,
    string IdempotencyKey,
    string State,
    string? DeliveryRequestId,
    string? MissionId,
    string? RequestFingerprint,
    DateTimeOffset PreparedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int Revision);

public interface IMonoDeliveryCorrelationStore
{
    Task<MonoDeliveryCorrelationSnapshot> PrepareAsync(Guid orderId,
        CancellationToken cancellationToken = default);
    Task<MonoDeliveryCorrelationSnapshot> RecordRequestIntentAsync(Guid orderId, string requestFingerprint,
        CancellationToken cancellationToken = default);
    Task<MonoDeliveryCorrelationSnapshot> RecordRequestReceivedAsync(Guid orderId,
        MonoDeliveryRequestCreated response, CancellationToken cancellationToken = default);
    Task<MonoDeliveryCorrelationSnapshot> RecordMissionAsync(Guid orderId,
        MonoDeliveryRequestDetail response, CancellationToken cancellationToken = default);
    Task<MonoDeliveryCorrelationSnapshot?> FindAsync(Guid orderId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Persists only Mono correlation identifiers and local state. Delivery addresses,
/// contacts, package contents, quotes and tracking payloads are never copied here.
/// </summary>
public sealed class MonoDeliveryCorrelationStore(
    HanaCommerceDbContext db, IClock clock) : IMonoDeliveryCorrelationStore
{
    public async Task<MonoDeliveryCorrelationSnapshot> PrepareAsync(Guid orderId,
        CancellationToken cancellationToken = default)
    {
        if (orderId == Guid.Empty) throw new ArgumentException("Order id is required.", nameof(orderId));
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockOrderAsync(orderId, cancellationToken);

        var document = await db.Documents.AsNoTracking().SingleOrDefaultAsync(
            item => item.Id == orderId && item.Kind == "ORDER", cancellationToken);
        if (document is null) throw new MonoDeliveryCorrelationException("ORDER_NOT_FOUND");
        var order = JsonSerializer.Deserialize<Order>(document.Body);
        if (order is null || order.Id != orderId || order.FulfillmentMode != "DELIVERY"
            || order.State is "CANCELLED" or "COLLECTED")
            throw new MonoDeliveryCorrelationException("ORDER_NOT_DELIVERABLE");

        var existing = await db.MonoDeliveryCorrelations.AsNoTracking()
            .SingleOrDefaultAsync(item => item.OrderId == orderId, cancellationToken);
        if (existing is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            return Snapshot(existing);
        }

        var now = clock.UtcNow;
        var created = new MonoDeliveryCorrelation
        {
            OrderId = orderId,
            IdempotencyKey = CreateIdempotencyKey(orderId),
            State = MonoDeliveryCorrelationStates.Prepared,
            PreparedAtUtc = now,
            UpdatedAtUtc = now,
            Revision = 1
        };
        db.MonoDeliveryCorrelations.Add(created);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Snapshot(created);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            throw new MonoDeliveryCorrelationException("CORRELATION_ALREADY_EXISTS");
        }
    }

    public async Task<MonoDeliveryCorrelationSnapshot> RecordRequestIntentAsync(
        Guid orderId, string requestFingerprint, CancellationToken cancellationToken = default)
    {
        if (orderId == Guid.Empty) throw new ArgumentException("Order id is required.", nameof(orderId));
        if (requestFingerprint is not { Length: 64 } ||
            requestFingerprint.Any(character =>
                !(character >= '0' && character <= '9' ||
                  character >= 'a' && character <= 'f')))
            throw new ArgumentException("A lowercase SHA-256 request fingerprint is required.", nameof(requestFingerprint));

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockOrderAsync(orderId, cancellationToken);
        var current = await RequireAsync(orderId, cancellationToken);
        if (current.DeliveryRequestId is not null)
        {
            if (current.RequestFingerprint != requestFingerprint)
                throw new MonoDeliveryCorrelationException("REQUEST_PAYLOAD_CONFLICT");
            await transaction.CommitAsync(cancellationToken);
            return Snapshot(current);
        }
        if (current.RequestFingerprint is not null)
        {
            if (current.RequestFingerprint != requestFingerprint)
                throw new MonoDeliveryCorrelationException("REQUEST_PAYLOAD_CONFLICT");
            await transaction.CommitAsync(cancellationToken);
            return Snapshot(current);
        }

        var changed = await db.MonoDeliveryCorrelations.Where(item =>
                item.OrderId == orderId && item.RequestFingerprint == null)
            .ExecuteUpdateAsync(update => update
                .SetProperty(item => item.RequestFingerprint, requestFingerprint)
                .SetProperty(item => item.UpdatedAtUtc, clock.UtcNow)
                .SetProperty(item => item.Revision, item => item.Revision + 1),
                cancellationToken);
        if (changed != 1)
            throw new MonoDeliveryCorrelationException("REQUEST_PAYLOAD_CONFLICT");

        var saved = await RequireAsync(orderId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Snapshot(saved);
    }

    public async Task<MonoDeliveryCorrelationSnapshot> RecordRequestReceivedAsync(Guid orderId,
        MonoDeliveryRequestCreated response, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Status != "RECEIVED" || !MonoIds.IsDeliveryRequestId(response.DeliveryRequestId))
            throw new MonoDeliveryCorrelationException("INVALID_PROVIDER_RESPONSE");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockOrderAsync(orderId, cancellationToken);
        var current = await RequireAsync(orderId, cancellationToken);
        if (current.DeliveryRequestId is not null && current.DeliveryRequestId != response.DeliveryRequestId)
            throw new MonoDeliveryCorrelationException("DELIVERY_REQUEST_CONFLICT");
        if (current.DeliveryRequestId is null)
        {
            try
            {
                var changed = await db.MonoDeliveryCorrelations.Where(item => item.OrderId == orderId
                    && item.DeliveryRequestId == null)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(item => item.DeliveryRequestId, response.DeliveryRequestId)
                        .SetProperty(item => item.State, MonoDeliveryCorrelationStates.RequestReceived)
                        .SetProperty(item => item.UpdatedAtUtc, clock.UtcNow)
                        .SetProperty(item => item.Revision, item => item.Revision + 1), cancellationToken);
                if (changed != 1)
                    throw new MonoDeliveryCorrelationException("DELIVERY_REQUEST_CONFLICT");
            }
            catch (Exception exception) when (IsUniqueViolation(exception))
            {
                throw new MonoDeliveryCorrelationException("PROVIDER_REFERENCE_ALREADY_LINKED");
            }
        }

        var saved = await RequireAsync(orderId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Snapshot(saved);
    }

    public async Task<MonoDeliveryCorrelationSnapshot> RecordMissionAsync(Guid orderId,
        MonoDeliveryRequestDetail response, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (!MonoIds.IsDeliveryRequestId(response.DeliveryRequestId)
            || !IsProviderIdentifier(response.MissionId))
            throw new MonoDeliveryCorrelationException("INVALID_PROVIDER_RESPONSE");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockOrderAsync(orderId, cancellationToken);
        var current = await RequireAsync(orderId, cancellationToken);
        if (current.DeliveryRequestId != response.DeliveryRequestId)
            throw new MonoDeliveryCorrelationException("DELIVERY_REQUEST_MISMATCH");
        if (current.MissionId is not null && current.MissionId != response.MissionId)
            throw new MonoDeliveryCorrelationException("MISSION_CONFLICT");
        if (current.MissionId is null)
        {
            try
            {
                var changed = await db.MonoDeliveryCorrelations.Where(item => item.OrderId == orderId
                    && item.DeliveryRequestId == response.DeliveryRequestId
                    && item.MissionId == null)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(item => item.MissionId, response.MissionId)
                        .SetProperty(item => item.State, MonoDeliveryCorrelationStates.MissionLinked)
                        .SetProperty(item => item.UpdatedAtUtc, clock.UtcNow)
                        .SetProperty(item => item.Revision, item => item.Revision + 1), cancellationToken);
                if (changed != 1)
                    throw new MonoDeliveryCorrelationException("MISSION_CONFLICT");
            }
            catch (Exception exception) when (IsUniqueViolation(exception))
            {
                throw new MonoDeliveryCorrelationException("PROVIDER_REFERENCE_ALREADY_LINKED");
            }
        }

        var saved = await RequireAsync(orderId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Snapshot(saved);
    }

    public async Task<MonoDeliveryCorrelationSnapshot?> FindAsync(Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var record = await db.MonoDeliveryCorrelations.AsNoTracking()
            .SingleOrDefaultAsync(item => item.OrderId == orderId, cancellationToken);
        return record is null ? null : Snapshot(record);
    }

    public static string CreateIdempotencyKey(Guid orderId) =>
        "henna-delivery-" + orderId.ToString("N");

    private async Task<MonoDeliveryCorrelation> RequireAsync(Guid orderId,
        CancellationToken cancellationToken) =>
        await db.MonoDeliveryCorrelations.AsNoTracking()
            .SingleOrDefaultAsync(item => item.OrderId == orderId, cancellationToken)
        ?? throw new MonoDeliveryCorrelationException("CORRELATION_NOT_PREPARED");

    private async Task LockOrderAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var key = "mono-delivery-correlation:" + orderId.ToString("N");
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
    }

    private static bool IsProviderIdentifier(string? value) => value is { Length: > 0 and <= 64 }
        && value.All(character => char.IsAsciiLetterOrDigit(character) || character is '_' or '-');

    private static bool IsUniqueViolation(Exception exception) =>
        exception is DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }
        || exception is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static MonoDeliveryCorrelationSnapshot Snapshot(MonoDeliveryCorrelation record) => new(
        record.OrderId, record.IdempotencyKey, record.State, record.DeliveryRequestId,
        record.MissionId, record.RequestFingerprint, record.PreparedAtUtc, record.UpdatedAtUtc, record.Revision);
}

public sealed class MonoDeliveryCorrelationException(string code)
    : Exception("Mono delivery correlation conflict.")
{
    public string Code { get; } = code;
}
