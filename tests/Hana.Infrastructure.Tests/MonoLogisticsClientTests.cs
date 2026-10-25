using System.Net;
using System.Text;
using System.Text.Json;
using Hana.Infrastructure.External;
using Microsoft.Extensions.Options;

namespace Hana.Infrastructure.Tests;

public sealed class MonoLogisticsClientTests
{
    [Fact]
    public async Task ListBranchesUsesReadOnlyTenantScopedEndpoint()
    {
        Uri? sentUri = null;
        HttpMethod? sentMethod = null;
        string? apiKey = null;
        string? idempotencyKey = null;
        var handler = new StubHandler((request, _) =>
        {
            sentUri = request.RequestUri;
            sentMethod = request.Method;
            apiKey = request.Headers.GetValues("X-Mono-API-Key").Single();
            idempotencyKey = request.Headers.Contains("Idempotency-Key") ? "unexpected" : null;
            return Task.FromResult(JsonResponse("""
                {"branches":[{"branchId":"br_0123456789abcdef0123456789abcdef","name":"شعبهٔ آزمایشی","address":"تهران","latitude":35.7,"longitude":51.4,"zoneId":"tehran","status":"ACTIVE"}]}
                """));
        });
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var result = await client.ListBranchesAsync(CancellationToken.None);

        Assert.Single(result.Branches);
        Assert.Equal("br_0123456789abcdef0123456789abcdef", result.Branches[0].BranchId);
        Assert.Equal(HttpMethod.Get, sentMethod);
        Assert.Equal("https://mono.example/v1/branches", sentUri!.ToString());
        Assert.Equal("secret-test-key", apiKey);
        Assert.Null(idempotencyKey);
    }

    [Fact]
    public async Task ListBranchesRejectsMalformedOrDuplicateProviderRows()
    {
        foreach (var body in new[]
        {
            """{"branches":[{"branchId":"bad","name":"x","status":"ACTIVE"}]}""",
            """{"branches":[{"branchId":"br_0123456789abcdef0123456789abcdef","name":"x","status":"ACTIVE"},{"branchId":"br_0123456789abcdef0123456789abcdef","name":"y","status":"ACTIVE"}]}"""
        })
        {
            using var http = new HttpClient(new StubHandler((_, _) =>
                Task.FromResult(JsonResponse(body))));
            var client = new MonoLogisticsClient(http, Options.Create(Configured()));
            var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() =>
                client.ListBranchesAsync(CancellationToken.None));
            Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
        }
    }

    [Fact]
    public async Task CreateUsesServerCredentialAndStableIdempotencyKey()
    {
        Uri? sentUri = null;
        HttpMethod? sentMethod = null;
        string? apiKey = null;
        string? idempotencyKey = null;
        string? requestBody = null;
        var handler = new StubHandler(async (request, _) =>
        {
            sentUri = request.RequestUri;
            sentMethod = request.Method;
            apiKey = request.Headers.GetValues("X-Mono-API-Key").Single();
            idempotencyKey = request.Headers.GetValues("Idempotency-Key").Single();
            requestBody = await request.Content!.ReadAsStringAsync();
            return JsonResponse("""
                {"delivery_request_id":"drq_0123456789abcdef0123456789abcdef","status":"RECEIVED","pickup_location_id":"loc_pickup","dropoff_location_id":"loc_dropoff","route_location_coordinates_status":"READY"}
                """);
        });
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var result = await client.CreateDeliveryRequestAsync(ValidRequest(),
            "order-0123-create-delivery", CancellationToken.None);

        Assert.Equal("RECEIVED", result.Status);
        Assert.Equal(HttpMethod.Post, sentMethod);
        Assert.Equal("https://mono.example/v1/delivery-requests", sentUri!.ToString());
        Assert.Equal("secret-test-key", apiKey);
        Assert.Equal("order-0123-create-delivery", idempotencyKey);
        using var body = JsonDocument.Parse(requestBody!);
        Assert.Equal("henna-order-0123", body.RootElement.GetProperty("external_reference").GetString());
        Assert.False(body.RootElement.GetProperty("pickup").TryGetProperty("contact_name", out _));
    }

    [Fact]
    public async Task CreateNeverTreatsProviderReceivedAsAccepted()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(JsonResponse("""
            {"delivery_request_id":"drq_0123456789abcdef0123456789abcdef","status":"ACCEPTED","pickup_location_id":"p","dropoff_location_id":"d","route_location_coordinates_status":"READY"}
            """)));
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() =>
            client.CreateDeliveryRequestAsync(ValidRequest(), "order-0123-create-delivery", CancellationToken.None));

        Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
    }

    [Fact]
    public async Task CreateRejectsIncompleteLocationBeforeNetworkCall()
    {
        var handler = new StubHandler((_, _) => throw new InvalidOperationException("Unexpected network call."));
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));
        var request = ValidRequest() with
        {
            Pickup = new MonoDeliveryLocation(null, null, null)
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.CreateDeliveryRequestAsync(request, "order-0123-create-delivery", CancellationToken.None));
    }

    [Fact]
    public async Task CreateRejectsHeaderInjectionInIdempotencyKey()
    {
        using var http = new HttpClient(new StubHandler((_, _) =>
            throw new InvalidOperationException("Unexpected network call.")));
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.CreateDeliveryRequestAsync(ValidRequest(), "valid\r\nX-Injected: yes", CancellationToken.None));
    }

    [Fact]
    public async Task MissingOrNonHttpsConfigurationFailsClosed()
    {
        using var http = new HttpClient(new StubHandler((_, _) =>
            throw new InvalidOperationException("Unexpected network call.")));
        var disabled = new MonoLogisticsClient(http, Options.Create(new MonoLogisticsOptions
        {
            Enabled = false,
            BaseUrl = "https://mono.example",
            ApiKey = "secret-test-key"
        }));
        var invalidEndpoint = new MonoLogisticsClient(http, Options.Create(new MonoLogisticsOptions
        {
            Enabled = true,
            BaseUrl = "http://mono.example",
            ApiKey = "secret-test-key"
        }));
        var unsafeCredential = new MonoLogisticsClient(http, Options.Create(new MonoLogisticsOptions
        {
            Enabled = true,
            BaseUrl = "https://mono.example",
            ApiKey = "key\r\nX-Injected: yes"
        }));

        Assert.False(disabled.IsAvailable);
        Assert.False(invalidEndpoint.IsAvailable);
        Assert.False(unsafeCredential.IsAvailable);
        await Assert.ThrowsAsync<MonoLogisticsException>(() =>
            disabled.GetDeliveryRequestAsync("drq_0123456789abcdef0123456789abcdef", CancellationToken.None));
    }

    [Fact]
    public async Task GetRequestUsesApiKeyAndProviderScopedDetailPath()
    {
        Uri? sentUri = null;
        HttpMethod? sentMethod = null;
        string? apiKey = null;
        var handler = new StubHandler((request, _) =>
        {
            sentUri = request.RequestUri;
            sentMethod = request.Method;
            apiKey = request.Headers.GetValues("X-Mono-API-Key").Single();
            return Task.FromResult(JsonResponse("""
                {"delivery_request_id":"drq_0123456789abcdef0123456789abcdef","external_reference":"henna-order-0123","status":"RECEIVED","created_at":"2026-10-25T12:00:00Z","mission_id":null,"mission_status":null,"committed_delivery_at":null,"quote":null,"promise":null}
                """));
        });
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var result = await client.GetDeliveryRequestAsync(
            "drq_0123456789abcdef0123456789abcdef", CancellationToken.None);

        Assert.Equal("RECEIVED", result.Status);
        Assert.Equal(HttpMethod.Get, sentMethod);
        Assert.Equal("secret-test-key", apiKey);
        Assert.Equal("https://mono.example/v1/delivery-requests/drq_0123456789abcdef0123456789abcdef", sentUri!.ToString());
    }

    [Fact]
    public async Task GetRejectsResponseForDifferentDeliveryRequest()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(JsonResponse("""
            {"delivery_request_id":"drq_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","external_reference":"henna-order-0123","status":"RECEIVED","created_at":"2026-10-25T12:00:00Z"}
            """)));
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() =>
            client.GetDeliveryRequestAsync("drq_0123456789abcdef0123456789abcdef", CancellationToken.None));

        Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
    }

    [Fact]
    public async Task GetParsesAndValidatesQuoteAndPromiseWithoutTreatingThemAsMissionAcceptance()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(JsonResponse("""
            {"delivery_request_id":"drq_0123456789abcdef0123456789abcdef","external_reference":"henna-order-0123","status":"RECEIVED","created_at":"2026-10-25T12:00:00Z","mission_id":null,"mission_status":null,"committed_delivery_at":null,"quote":{"quote_id":"qte_test_001","delivery_request_id":"drq_0123456789abcdef0123456789abcdef","version":1,"issued_at":"2026-10-25T12:01:00Z","expires_at":"2026-10-25T12:16:00Z","is_expired":false,"distance_meters":1500,"fare_toman":35000,"buyer_share_toman":17500,"seller_share_toman":17500,"recorded_at":"2026-10-25T12:01:00Z"},"promise":{"promise_id":"prm_test_001","delivery_request_id":"drq_0123456789abcdef0123456789abcdef","version":1,"committed_delivery_at":"2026-10-25T15:00:00Z","outcome":"ACCEPTED"}}
            """)));
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var result = await client.GetDeliveryRequestAsync(
            "drq_0123456789abcdef0123456789abcdef", CancellationToken.None);

        Assert.Equal(35000, result.Quote!.FareToman);
        Assert.Equal(1, result.Promise!.Version);
        Assert.Null(result.MissionId);
        Assert.Null(result.MissionStatus);
    }

    [Fact]
    public async Task GetRejectsMalformedQuoteAndPromisePayloads()
    {
        var requestId = "drq_0123456789abcdef0123456789abcdef";
        var bodies = new[]
        {
            """{"delivery_request_id":"REQ_ID","external_reference":"henna-order-0123","status":"RECEIVED","created_at":"2026-10-25T12:00:00Z","quote":{"quote_id":"qte_test_001","delivery_request_id":"REQ_ID","version":1,"issued_at":"2026-10-25T12:01:00Z","expires_at":"2026-10-25T12:16:00Z","is_expired":false,"distance_meters":1500,"fare_toman":35000,"buyer_share_toman":20000,"seller_share_toman":10000,"recorded_at":"2026-10-25T12:01:00Z"},"promise":null}""".Replace("REQ_ID", requestId, StringComparison.Ordinal),
            """{"delivery_request_id":"REQ_ID","external_reference":"henna-order-0123","status":"RECEIVED","created_at":"2026-10-25T12:00:00Z","quote":null,"promise":{"promise_id":"prm_test_001","delivery_request_id":"drq_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":1,"committed_delivery_at":"2026-10-25T15:00:00Z","outcome":"ACCEPTED"}}""".Replace("REQ_ID", requestId, StringComparison.Ordinal)
        };

        foreach (var body in bodies)
        {
            using var http = new HttpClient(new StubHandler((_, _) =>
                Task.FromResult(JsonResponse(body))));
            var client = new MonoLogisticsClient(http, Options.Create(Configured()));

            var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() =>
                client.GetDeliveryRequestAsync(requestId, CancellationToken.None));

            Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
        }
    }

    [Fact]
    public async Task CourierLocationUsesCustomerApiKeyAndRejectsStalePoints()
    {
        Uri? sentUri = null;
        string? apiKey = null;
        var handler = new StubHandler((request, _) =>
        {
            sentUri = request.RequestUri;
            apiKey = request.Headers.GetValues("X-Mono-API-Key").Single();
            var body = JsonSerializer.Serialize(new
            {
                latitude = 35.7, longitude = 51.4, accuracy_meters = 8,
                observed_at = DateTimeOffset.UtcNow.AddMinutes(-5)
            });
            return Task.FromResult(JsonResponse(body));
        });
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var exception = await Assert.ThrowsAsync<MonoLogisticsException>(() =>
            client.GetCourierCurrentLocationAsync(
                "mis_0123456789abcdef0123456789abcdef", CancellationToken.None));

        Assert.Equal("INVALID_PROVIDER_RESPONSE", exception.ProviderCode);
        Assert.Equal("secret-test-key", apiKey);
        Assert.Equal("https://mono.example/v1/missions/mis_0123456789abcdef0123456789abcdef/courier-location", sentUri!.ToString());
    }

    [Fact]
    public async Task CourierLocationTreatsUnavailablePointAsNoLivePosition()
    {
        var handler = new StubHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)
        {
            Content = new StringContent("{\\\"error\\\":{\\\"code\\\":\\\"COURIER_LOCATION_UNAVAILABLE\\\"}}", Encoding.UTF8, "application/json")
        }));
        using var http = new HttpClient(handler);
        var client = new MonoLogisticsClient(http, Options.Create(Configured()));

        var result = await client.GetCourierCurrentLocationAsync(
            "mis_0123456789abcdef0123456789abcdef", CancellationToken.None);

        Assert.Null(result);
    }

    private static MonoLogisticsOptions Configured() => new()
    {
        Enabled = true,
        BaseUrl = "https://mono.example",
        ApiKey = "secret-test-key"
    };

    private static MonoDeliveryRequestInput ValidRequest() => new(
        "henna-order-0123", "br_0123456789abcdef0123456789abcdef",
        new MonoDeliveryLocation("فروشگاه", 35.7m, 51.4m),
        new MonoDeliveryLocation("مقصد", 35.8m, 51.5m),
        new MonoShipment("BAG_BASED", 1, "S"));

    private static HttpResponseMessage JsonResponse(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken) =>
            send(request, cancellationToken);
    }
}
