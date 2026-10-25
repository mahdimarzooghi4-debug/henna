using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Hana.Infrastructure.External;

public sealed class MonoLogisticsOptions
{
    public const string SectionName = "MonoLogistics";
    public bool Enabled { get; set; }
    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }

    public bool IsConfigured => Enabled && Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)
        && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment)
        && ApiKey is { Length: > 0 and <= 512 }
        && ApiKey.All(character => character is >= '!' and <= '~');
}

public interface IMonoLogisticsClient
{
    bool IsAvailable { get; }
    Task<MonoBranchList> ListBranchesAsync(CancellationToken cancellationToken);
    Task<MonoDeliveryRequestCreated> CreateDeliveryRequestAsync(
        MonoDeliveryRequestInput request, string idempotencyKey,
        CancellationToken cancellationToken);
    Task<MonoDeliveryRequestDetail> GetDeliveryRequestAsync(
        string deliveryRequestId, CancellationToken cancellationToken);
}

/// <summary>
/// Server-to-server transport for Mono B2B v1. It deliberately does not retry
/// POSTs automatically; callers may replay a command only with the same stable
/// Idempotency-Key. This class does not imply a delivery is accepted: Mono's
/// create response is only RECEIVED.
/// </summary>
public sealed class MonoLogisticsClient : IMonoLogisticsClient
{
    private const int MaxResponseBytes = 64 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private readonly HttpClient http;
    private readonly MonoLogisticsOptions options;

    public MonoLogisticsClient(HttpClient http, IOptions<MonoLogisticsOptions> options)
    {
        this.http = http;
        this.options = options.Value;
        this.http.Timeout = TimeSpan.FromSeconds(8);
    }

    public bool IsAvailable => options.IsConfigured;

    public async Task<MonoBranchList> ListBranchesAsync(CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var message = CreateMessage(HttpMethod.Get, "v1/branches");
        using var response = await SendAsync(message, cancellationToken);
        var result = await ReadAsync<MonoBranchList>(response, cancellationToken);
        if (result.Branches is null || result.Branches.Count > 500
            || result.Branches.Any(branch => branch is null
                || !MonoIds.IsBranchId(branch.BranchId)
                || string.IsNullOrWhiteSpace(branch.Name) || branch.Name.Length > 200
                || string.IsNullOrWhiteSpace(branch.Status) || branch.Status.Length > 32
                || (branch.Latitude is null) != (branch.Longitude is null)
                || branch.Latitude is < -90 or > 90
                || branch.Longitude is < -180 or > 180
                || branch.Address is { Length: > 500 }
                || branch.ZoneId is { Length: > 128 })
            || result.Branches.Select(branch => branch.BranchId)
                .Distinct(StringComparer.Ordinal).Count() != result.Branches.Count)
            throw new MonoLogisticsException(HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");
        return result;
    }

    public async Task<MonoDeliveryRequestCreated> CreateDeliveryRequestAsync(
        MonoDeliveryRequestInput request, string idempotencyKey,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        EnsureConfigured();
        if (idempotencyKey is not { Length: > 0 and <= 128 }
            || !idempotencyKey.All(character => char.IsAsciiLetterOrDigit(character)
                || character is '.' or '_' or '~' or '-'))
            throw new ArgumentException("A stable provider idempotency key is required.", nameof(idempotencyKey));
        if (!request.IsValid())
            throw new ArgumentException("The Mono delivery request is incomplete or invalid.", nameof(request));

        using var message = CreateMessage(HttpMethod.Post, "v1/delivery-requests");
        message.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        message.Content = JsonContent.Create(request, options: JsonOptions);
        using var response = await SendAsync(message, cancellationToken);
        var result = await ReadAsync<MonoDeliveryRequestCreated>(response, cancellationToken);
        if (result.Status != "RECEIVED" || !MonoIds.IsDeliveryRequestId(result.DeliveryRequestId))
            throw new MonoLogisticsException(HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");
        return result;
    }

    public async Task<MonoDeliveryRequestDetail> GetDeliveryRequestAsync(
        string deliveryRequestId, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!MonoIds.IsDeliveryRequestId(deliveryRequestId))
            throw new ArgumentException("Invalid Mono delivery request identifier.", nameof(deliveryRequestId));
        using var message = CreateMessage(HttpMethod.Get,
            "v1/delivery-requests/" + Uri.EscapeDataString(deliveryRequestId));
        using var response = await SendAsync(message, cancellationToken);
        var result = await ReadAsync<MonoDeliveryRequestDetail>(response, cancellationToken);
        if (result.DeliveryRequestId != deliveryRequestId
            || string.IsNullOrWhiteSpace(result.ExternalReference)
            || string.IsNullOrWhiteSpace(result.Status)
            || result.CreatedAt == default
            || !result.HasValidQuoteAndPromise())
            throw new MonoLogisticsException(HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");
        return result;
    }

    private HttpRequestMessage CreateMessage(HttpMethod method, string relativePath)
    {
        var baseUri = new Uri(options.BaseUrl!.TrimEnd('/') + "/", UriKind.Absolute);
        var message = new HttpRequestMessage(method, new Uri(baseUri, relativePath));
        message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        message.Headers.TryAddWithoutValidation("X-Mono-API-Key", options.ApiKey);
        return message;
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage message, CancellationToken cancellationToken)
    {
        try
        {
            var response = await http.SendAsync(message,
                HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var status = response.StatusCode;
                string code;
                try { code = await ReadErrorCodeAsync(response, cancellationToken); }
                finally { response.Dispose(); }
                throw new MonoLogisticsException(status, code);
            }
            return response;
        }
        catch (MonoLogisticsException) { throw; }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new MonoLogisticsException(HttpStatusCode.GatewayTimeout, "PROVIDER_TIMEOUT");
        }
        catch (HttpRequestException)
        {
            throw new MonoLogisticsException(HttpStatusCode.BadGateway, "PROVIDER_UNAVAILABLE");
        }
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var body = await ReadBoundedAsync(response, cancellationToken);
        try
        {
            return JsonSerializer.Deserialize<T>(body, JsonOptions)
                ?? throw new MonoLogisticsException(HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");
        }
        catch (JsonException)
        {
            throw new MonoLogisticsException(HttpStatusCode.BadGateway, "INVALID_PROVIDER_RESPONSE");
        }
    }

    private static async Task<string> ReadErrorCodeAsync(HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            var body = await ReadBoundedAsync(response, cancellationToken);
            using var document = JsonDocument.Parse(body);
            var providerCode = document.RootElement.TryGetProperty("error", out var error)
                && error.TryGetProperty("code", out var code)
                && code.ValueKind == JsonValueKind.String
                ? code.GetString() : null;
            return providerCode is { Length: > 0 and <= 64 }
                && providerCode.All(character => char.IsAsciiLetterOrDigit(character) || character == '_')
                ? providerCode : "PROVIDER_ERROR";
        }
        catch (Exception exception) when (exception is JsonException or IOException or InvalidDataException)
        {
            return "PROVIDER_ERROR";
        }
    }

    private static async Task<string> ReadBoundedAsync(HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var buffer = new MemoryStream();
        var chunk = new byte[4096];
        while (true)
        {
            var count = await stream.ReadAsync(chunk, cancellationToken);
            if (count == 0) break;
            if (buffer.Length + count > MaxResponseBytes)
                throw new MonoLogisticsException(HttpStatusCode.BadGateway, "PROVIDER_RESPONSE_TOO_LARGE");
            buffer.Write(chunk, 0, count);
        }
        return System.Text.Encoding.UTF8.GetString(buffer.ToArray());
    }

    private void EnsureConfigured()
    {
        if (!options.IsConfigured)
            throw new MonoLogisticsException(HttpStatusCode.ServiceUnavailable, "PROVIDER_NOT_CONFIGURED");
    }
}

public sealed class MonoExternalLogisticsProvider(IOptions<MonoLogisticsOptions> options)
    : IExternalLogisticsProvider
{
    public bool IsAvailable => options.Value.IsConfigured;
}

public sealed class MonoLogisticsException(HttpStatusCode statusCode, string providerCode)
    : Exception("Mono logistics request failed.")
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public string ProviderCode { get; } = providerCode;
}

public sealed record MonoDeliveryRequestInput(
    [property: JsonPropertyName("external_reference")] string ExternalReference,
    [property: JsonPropertyName("branch_id")] string BranchId,
    [property: JsonPropertyName("pickup")] MonoDeliveryLocation Pickup,
    [property: JsonPropertyName("dropoff")] MonoDeliveryLocation Dropoff,
    [property: JsonPropertyName("shipment")] MonoShipment Shipment,
    [property: JsonPropertyName("requested_service")] string RequestedService = "URBAN_DELIVERY",
    [property: JsonPropertyName("requested_priority")] string RequestedPriority = "STANDARD",
    [property: JsonPropertyName("estimated_ready_at")] DateTimeOffset? EstimatedReadyAt = null)
{
    public bool IsValid() => !string.IsNullOrWhiteSpace(ExternalReference)
        && ExternalReference.Length <= 128
        && MonoIds.IsBranchId(BranchId)
        && Pickup is not null && Pickup.IsValid()
        && Dropoff is not null && Dropoff.IsValid()
        && Shipment is not null && Shipment.IsValid()
        && RequestedService == "URBAN_DELIVERY"
        && RequestedPriority == "STANDARD";
}

public sealed record MonoBranchList(
    [property: JsonPropertyName("branches")] List<MonoBranchSummary> Branches);

public sealed record MonoBranchSummary(
    [property: JsonPropertyName("branchId")] string BranchId,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("address")] string? Address,
    [property: JsonPropertyName("latitude")] decimal? Latitude,
    [property: JsonPropertyName("longitude")] decimal? Longitude,
    [property: JsonPropertyName("zoneId")] string? ZoneId,
    [property: JsonPropertyName("status")] string Status);

public sealed record MonoDeliveryLocation(
    [property: JsonPropertyName("address_text")] string? AddressText,
    [property: JsonPropertyName("latitude")] decimal? Latitude,
    [property: JsonPropertyName("longitude")] decimal? Longitude,
    [property: JsonPropertyName("contact_name")] string? ContactName = null,
    [property: JsonPropertyName("contact_phone")] string? ContactPhone = null,
    [property: JsonPropertyName("recipient_name")] string? RecipientName = null,
    [property: JsonPropertyName("recipient_phone")] string? RecipientPhone = null,
    [property: JsonPropertyName("address_details")] string? AddressDetails = null)
{
    public bool IsValid() => (!string.IsNullOrWhiteSpace(AddressText)
        || Latitude is not null && Longitude is not null)
        && (Latitude is null) == (Longitude is null)
        && (Latitude is null || Latitude is >= -90 and <= 90)
        && (Longitude is null || Longitude is >= -180 and <= 180)
        && new[] { AddressText, ContactName, ContactPhone, RecipientName, RecipientPhone, AddressDetails }
            .All(value => value is null || value.Length <= 500);
}

public sealed record MonoShipment(
    [property: JsonPropertyName("shipment_model")] string ShipmentModel,
    [property: JsonPropertyName("bag_count")] int BagCount,
    [property: JsonPropertyName("load_class")] string LoadClass,
    [property: JsonPropertyName("estimated_weight_kg")] decimal? EstimatedWeightKg = null,
    [property: JsonPropertyName("fragile")] bool? Fragile = null,
    [property: JsonPropertyName("liquid")] bool? Liquid = null,
    [property: JsonPropertyName("keep_upright")] bool? KeepUpright = null,
    [property: JsonPropertyName("package_count")] int? PackageCount = null,
    [property: JsonPropertyName("estimated_volume_m3")] decimal? EstimatedVolumeM3 = null,
    [property: JsonPropertyName("temperature_class")] string? TemperatureClass = null)
{
    public bool IsValid() => ShipmentModel == "BAG_BASED" && BagCount >= 1
        && LoadClass is "S" or "M" or "L"
        && (EstimatedWeightKg is null || EstimatedWeightKg > 0)
        && (PackageCount is null || PackageCount >= 1)
        && (EstimatedVolumeM3 is null || EstimatedVolumeM3 > 0)
        && (TemperatureClass is null || TemperatureClass is "AMBIENT" or "CHILLED" or "FROZEN");
}

public sealed record MonoDeliveryRequestCreated(
    [property: JsonPropertyName("delivery_request_id")] string DeliveryRequestId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("pickup_location_id")] string PickupLocationId,
    [property: JsonPropertyName("dropoff_location_id")] string DropoffLocationId,
    [property: JsonPropertyName("route_location_coordinates_status")] string RouteLocationCoordinatesStatus);

public sealed record MonoDeliveryRequestDetail(
    [property: JsonPropertyName("delivery_request_id")] string DeliveryRequestId,
    [property: JsonPropertyName("external_reference")] string ExternalReference,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("mission_id")] string? MissionId,
    [property: JsonPropertyName("mission_status")] string? MissionStatus,
    [property: JsonPropertyName("committed_delivery_at")] DateTimeOffset? CommittedDeliveryAt,
    [property: JsonPropertyName("quote")] MonoDeliveryQuote? Quote,
    [property: JsonPropertyName("promise")] MonoDeliveryPromise? Promise)
{
    public bool HasValidQuoteAndPromise() =>
        (Quote is null || Quote.IsValidFor(DeliveryRequestId))
        && (Promise is null || Promise.IsValidFor(DeliveryRequestId));
}

public sealed record MonoDeliveryQuote(
    [property: JsonPropertyName("quote_id")] string QuoteId,
    [property: JsonPropertyName("delivery_request_id")] string DeliveryRequestId,
    [property: JsonPropertyName("version")] int Version,
    [property: JsonPropertyName("issued_at")] DateTimeOffset IssuedAt,
    [property: JsonPropertyName("expires_at")] DateTimeOffset ExpiresAt,
    [property: JsonPropertyName("is_expired")] bool IsExpired,
    [property: JsonPropertyName("distance_meters")] int DistanceMeters,
    [property: JsonPropertyName("fare_toman")] long FareToman,
    [property: JsonPropertyName("buyer_share_toman")] long BuyerShareToman,
    [property: JsonPropertyName("seller_share_toman")] long SellerShareToman,
    [property: JsonPropertyName("recorded_at")] DateTimeOffset RecordedAt)
{
    public bool IsValidFor(string requestId) =>
        !string.IsNullOrWhiteSpace(QuoteId) && QuoteId.Length <= 128
        && DeliveryRequestId == requestId && Version > 0
        && IssuedAt != default && ExpiresAt > IssuedAt && RecordedAt != default
        && DistanceMeters > 0 && FareToman > 0
        && BuyerShareToman >= 0 && SellerShareToman >= 0
        && (decimal)BuyerShareToman + SellerShareToman == FareToman;
}

public sealed record MonoDeliveryPromise(
    [property: JsonPropertyName("promise_id")] string PromiseId,
    [property: JsonPropertyName("delivery_request_id")] string DeliveryRequestId,
    [property: JsonPropertyName("version")] int Version,
    [property: JsonPropertyName("committed_delivery_at")] DateTimeOffset CommittedDeliveryAt,
    [property: JsonPropertyName("outcome")] string Outcome)
{
    public bool IsValidFor(string requestId) =>
        !string.IsNullOrWhiteSpace(PromiseId) && PromiseId.Length <= 128
        && DeliveryRequestId == requestId && Version > 0
        && CommittedDeliveryAt != default && !string.IsNullOrWhiteSpace(Outcome)
        && Outcome.Length <= 32;
}

internal static class MonoIds
{
    public static bool IsBranchId(string? value) => IsPrefixedHexId(value, "br_");
    public static bool IsDeliveryRequestId(string? value) => IsPrefixedHexId(value, "drq_");
    private static bool IsPrefixedHexId(string? value, string prefix) =>
        value is not null && value.Length == prefix.Length + 32
        && value.StartsWith(prefix, StringComparison.Ordinal)
        && value.AsSpan(prefix.Length).ToString().All(character =>
            character is >= '0' and <= '9' or >= 'a' and <= 'f');
}
