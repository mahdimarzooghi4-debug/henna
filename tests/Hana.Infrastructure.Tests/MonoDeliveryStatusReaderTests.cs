using Hana.Infrastructure.External;

namespace Hana.Infrastructure.Tests;

public sealed class MonoDeliveryStatusReaderTests
{
    [Fact]
    public async Task PreparedCorrelationDoesNotCallMono()
    {
        var orderId = Guid.ParseExact("0123456789abcdef0123456789abcdef", "N");
        var correlation = Correlation(orderId, null, null, "PREPARED", 1);
        var store = new FakeStore(correlation);
        var mono = new FakeMonoClient(null);
        var reader = new MonoDeliveryStatusReader(store, mono);

        var result = await reader.ReadAsync(orderId);

        Assert.Equal("PREPARED", result.CorrelationState);
        Assert.Null(result.DeliveryRequestId);
        Assert.Null(result.ProviderStatus);
        Assert.Equal(0, mono.DetailReads);
    }

    [Fact]
    public async Task ReadRefreshesMonoDetailAndLinksMissionWithoutPersistingProviderPayload()
    {
        var orderId = Guid.ParseExact("0123456789abcdef0123456789abcdef", "N");
        const string requestId = "drq_0123456789abcdef0123456789abcdef";
        const string missionId = "mis_0123456789abcdef0123456789abcdef";
        var correlation = Correlation(orderId, requestId, null, "REQUEST_RECEIVED", 2);
        var detail = new MonoDeliveryRequestDetail(
            requestId, orderId.ToString("N"), "RECEIVED", DateTimeOffset.Parse("2026-10-25T12:00:00Z"),
            missionId, "PROMISED", DateTimeOffset.Parse("2026-10-25T15:00:00Z"), null,
            new MonoDeliveryPromise("prm_test_001", requestId, 1,
                DateTimeOffset.Parse("2026-10-25T15:00:00Z"), "ACCEPTED"));
        var store = new FakeStore(correlation);
        var mono = new FakeMonoClient(detail);
        var reader = new MonoDeliveryStatusReader(store, mono);

        var result = await reader.ReadAsync(orderId);

        Assert.Equal("RECEIVED", result.ProviderStatus);
        Assert.Equal("PROMISED", result.MissionStatus);
        Assert.Equal(missionId, result.MissionId);
        Assert.Equal("ACCEPTED", result.Promise!.Outcome);
        Assert.Equal(1, mono.DetailReads);
        Assert.Equal(1, store.MissionWrites);
        Assert.Equal("REQUEST_RECEIVED", correlation.State);
    }

    [Fact]
    public async Task ReadRejectsDetailThatBelongsToAnotherHennaOrder()
    {
        var orderId = Guid.ParseExact("0123456789abcdef0123456789abcdef", "N");
        const string requestId = "drq_0123456789abcdef0123456789abcdef";
        var correlation = Correlation(orderId, requestId, null, "REQUEST_RECEIVED", 2);
        var detail = new MonoDeliveryRequestDetail(
            requestId, "another-order", "RECEIVED", DateTimeOffset.Parse("2026-10-25T12:00:00Z"),
            null, null, null, null, null);
        var reader = new MonoDeliveryStatusReader(new FakeStore(correlation), new FakeMonoClient(detail));

        var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() => reader.ReadAsync(orderId));

        Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
    }

    private static MonoDeliveryCorrelationSnapshot Correlation(
        Guid orderId, string? requestId, string? missionId, string state, int revision) =>
        new(orderId, MonoDeliveryCorrelationStore.CreateIdempotencyKey(orderId),
            state, requestId, missionId, DateTimeOffset.Parse("2026-10-25T12:00:00Z"),
            DateTimeOffset.Parse("2026-10-25T12:00:00Z"), revision);

    private sealed class FakeStore(MonoDeliveryCorrelationSnapshot correlation)
        : IMonoDeliveryCorrelationStore
    {
        public int MissionWrites { get; private set; }

        public Task<MonoDeliveryCorrelationSnapshot?> FindAsync(
            Guid orderId, CancellationToken cancellationToken = default) =>
            Task.FromResult<MonoDeliveryCorrelationSnapshot?>(
                orderId == correlation.OrderId ? correlation : null);

        public Task<MonoDeliveryCorrelationSnapshot> RecordMissionAsync(
            Guid orderId, MonoDeliveryRequestDetail response,
            CancellationToken cancellationToken = default)
        {
            MissionWrites++;
            return Task.FromResult(correlation with
            {
                State = MonoDeliveryCorrelationStates.MissionLinked,
                MissionId = response.MissionId,
                Revision = correlation.Revision + 1
            });
        }

        public Task<MonoDeliveryCorrelationSnapshot> PrepareAsync(
            Guid orderId, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task<MonoDeliveryCorrelationSnapshot> RecordRequestReceivedAsync(
            Guid orderId, MonoDeliveryRequestCreated response,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private sealed class FakeMonoClient(MonoDeliveryRequestDetail? detail) : IMonoLogisticsClient
    {
        public int DetailReads { get; private set; }
        public bool IsAvailable => true;

        public Task<MonoBranchList> ListBranchesAsync(CancellationToken cancellationToken) =>
            throw new NotImplementedException();

        public Task<MonoDeliveryRequestCreated> CreateDeliveryRequestAsync(
            MonoDeliveryRequestInput request, string idempotencyKey,
            CancellationToken cancellationToken) =>
            throw new NotImplementedException();

        public Task<MonoDeliveryRequestDetail> GetDeliveryRequestAsync(
            string deliveryRequestId, CancellationToken cancellationToken)
        {
            DetailReads++;
            return detail is null
                ? throw new InvalidOperationException("Unexpected Mono read.")
                : Task.FromResult(detail);
        }
    }
}
