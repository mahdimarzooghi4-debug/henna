using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Hana.Infrastructure.External;

/// <summary>
/// Produces the exact deterministic JSON fingerprint used by the Mono create
/// transport. Only the digest is persisted; request content may contain PII.
/// </summary>
public static class MonoDeliveryRequestFingerprint
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static string Compute(MonoDeliveryRequestInput request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!request.IsValid())
            throw new ArgumentException("A valid Mono request is required.", nameof(request));

        var bytes = JsonSerializer.SerializeToUtf8Bytes(request, JsonOptions);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}
