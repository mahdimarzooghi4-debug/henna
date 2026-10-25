using System.Text.Json;
using Hana.Application.Time;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.External;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class MonoDeliveryCorrelationStoreTests
{
    [Fact]
    public async Task OrderCorrelationIsStableAcrossRetryAndLinksMonoReferencesIdempotently()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__CommerceDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        await using var db = Context(connection);
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var orderId = Guid.NewGuid();
        var buyerId = Guid.NewGuid();
        var sellerId = Guid.NewGuid();
        db.Documents.Add(new CommerceDocument
        {
            Id = orderId,
            OwnerId = buyerId,
            Kind = "ORDER",
            Revision = 1,
            Body = JsonSerializer.Serialize(new Order(
                orderId, buyerId, sellerId, "PERSONAL", "DELIVERY",
                new BuyerAddress(Guid.NewGuid(), buyerId, Guid.NewGuid(),
                    "test-only destination", 35.7m, 51.4m), [], 1000, 1000, 0,
                null, "PAID", "NONE", 1, now, null, null))
        });
        await db.SaveChangesAsync();

        var store = new MonoDeliveryCorrelationStore(db, new FixedClock(now));
        var prepared = await store.PrepareAsync(orderId);
        var repeated = await store.PrepareAsync(orderId);

        Assert.Equal("PREPARED", prepared.State);
        Assert.Null(prepared.DeliveryRequestId);
        Assert.Null(prepared.MissionId);
        Assert.Equal(MonoDeliveryCorrelationStore.CreateIdempotencyKey(orderId), prepared.IdempotencyKey);
        Assert.Equal(prepared.IdempotencyKey, repeated.IdempotencyKey);
        Assert.Equal(1, repeated.Revision);

        var request = new MonoDeliveryRequestInput(
            orderId.ToString("N"), "br_0123456789abcdef0123456789abcdef",
            new MonoDeliveryLocation("test pickup", 35.7m, 51.4m),
            new MonoDeliveryLocation("test dropoff", 35.8m, 51.5m),
            new MonoShipment("BAG_BASED", 1, "S"));
        var intent = await store.RecordRequestIntentAsync(orderId, request);
        var intentReplay = await store.RecordRequestIntentAsync(orderId, request);
        Assert.NotNull(intent.RequestFingerprint);
        Assert.Equal(intent.RequestFingerprint, intentReplay.RequestFingerprint);
        Assert.Equal(2, intentReplay.Revision);
        Assert.False(JsonSerializer.Serialize(intent).Contains("test dropoff", StringComparison.Ordinal));

        var changedRequest = request with
        {
            Dropoff = new MonoDeliveryLocation("changed test dropoff", 35.8m, 51.5m)
        };
        var changedIntent = await Assert.ThrowsAsync<MonoDeliveryCorrelationException>(
            () => store.RecordRequestIntentAsync(orderId, changedRequest));
        Assert.Equal("REQUEST_PAYLOAD_CONFLICT", changedIntent.Code);

        var requestId = "drq_0123456789abcdef0123456789abcdef";
        var receivedResponse = new MonoDeliveryRequestCreated(
            requestId, "RECEIVED", "pickup_location", "dropoff_location", "READY");
        var received = await store.RecordRequestReceivedAsync(orderId, receivedResponse);
        var receivedReplay = await store.RecordRequestReceivedAsync(orderId, receivedResponse);
        Assert.Equal(MonoDeliveryCorrelationStates.RequestReceived, received.State);
        Assert.Equal(requestId, received.DeliveryRequestId);
        Assert.Equal(3, receivedReplay.Revision);

        var secondOrderId = Guid.NewGuid();
        db.Documents.Add(new CommerceDocument
        {
            Id = secondOrderId,
            OwnerId = buyerId,
            Kind = "ORDER",
            Revision = 1,
            Body = JsonSerializer.Serialize(new Order(
                secondOrderId, buyerId, sellerId, "PERSONAL", "DELIVERY",
                new BuyerAddress(Guid.NewGuid(), buyerId, Guid.NewGuid(),
                    "another test-only destination", 35.8m, 51.5m), [], 1000, 1000, 0,
                null, "PAID", "NONE", 1, now, null, null))
        });
        await db.SaveChangesAsync();
        await store.PrepareAsync(secondOrderId);
        var secondRequest = request with { ExternalReference = secondOrderId.ToString("N") };
        await store.RecordRequestIntentAsync(secondOrderId, secondRequest);
        var duplicateLink = await Assert.ThrowsAsync<MonoDeliveryCorrelationException>(() =>
            store.RecordRequestReceivedAsync(secondOrderId, receivedResponse));
        Assert.Equal("PROVIDER_REFERENCE_ALREADY_LINKED", duplicateLink.Code);

        var mission = new MonoDeliveryRequestDetail(requestId, "henna-order-reference",
            "MISSION_CREATED", now, "mission_0123456789abcdef", "ASSIGNED",
            null, null, null);
        var linked = await store.RecordMissionAsync(orderId, mission);
        var missionReplay = await store.RecordMissionAsync(orderId, mission);
        Assert.Equal(MonoDeliveryCorrelationStates.MissionLinked, linked.State);
        Assert.Equal("mission_0123456789abcdef", linked.MissionId);
        Assert.Equal(linked.Revision, missionReplay.Revision);
        Assert.Null((await store.FindAsync(Guid.NewGuid())));
    }

    [Fact]
    public async Task PrepareRejectsPickupOrdersAndUnknownOrders()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__CommerceDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        await using var db = Context(connection);
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var pickupId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        db.Documents.Add(new CommerceDocument
        {
            Id = pickupId,
            OwnerId = accountId,
            Kind = "ORDER",
            Revision = 1,
            Body = JsonSerializer.Serialize(new Order(
                pickupId, accountId, Guid.NewGuid(), "PERSONAL", "PICKUP",
                new BuyerAddress(Guid.NewGuid(), accountId, Guid.NewGuid(), "test", 35m, 51m),
                [], 1000, 1000, 0, null, "PAID", "NONE", 1, now, null, null))
        });
        await db.SaveChangesAsync();
        var store = new MonoDeliveryCorrelationStore(db, new FixedClock(now));

        var pickupError = await Assert.ThrowsAsync<MonoDeliveryCorrelationException>(
            () => store.PrepareAsync(pickupId));
        var missingError = await Assert.ThrowsAsync<MonoDeliveryCorrelationException>(
            () => store.PrepareAsync(Guid.NewGuid()));

        Assert.Equal("ORDER_NOT_DELIVERABLE", pickupError.Code);
        Assert.Equal("ORDER_NOT_FOUND", missingError.Code);
    }

    private static HanaCommerceDbContext Context(string connection) => new(
        new DbContextOptionsBuilder<HanaCommerceDbContext>()
            .UseNpgsql(connection, postgres =>
                postgres.MigrationsHistoryTable("__EFMigrationsHistory", "commerce"))
            .Options);

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }
}
