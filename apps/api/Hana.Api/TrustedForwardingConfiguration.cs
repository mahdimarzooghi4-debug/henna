using System.Net;

namespace Hana.Api;

internal sealed record TrustedForwardingConfiguration(
    IReadOnlyList<IPAddress> KnownProxies,
    IReadOnlyList<IPNetwork> KnownNetworks)
{
    private const string UnsafeFrameworkSwitch = "ASPNETCORE_FORWARDEDHEADERS_ENABLED";

    public static TrustedForwardingConfiguration? Load(IConfiguration configuration)
    {
        if (string.Equals(Environment.GetEnvironmentVariable(UnsafeFrameworkSwitch),
            "true", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"{UnsafeFrameworkSwitch}=true is not allowed. Configure ReverseProxy:TrustedAddresses explicitly.");
        }

        if (!configuration.GetValue<bool>("ReverseProxy:Enabled"))
            return null;

        var raw = configuration["ReverseProxy:TrustedAddresses"];
        var entries = raw?.Split([',', ';'], StringSplitOptions.TrimEntries |
            StringSplitOptions.RemoveEmptyEntries) ?? [];

        if (entries.Length == 0)
            throw new InvalidOperationException(
                "ReverseProxy:Enabled requires at least one exact proxy IP or CIDR in ReverseProxy:TrustedAddresses.");

        var proxies = new HashSet<IPAddress>();
        var networks = new HashSet<IPNetwork>();

        foreach (var entry in entries)
        {
            if (IPAddress.TryParse(entry, out var address))
            {
                proxies.Add(Normalize(address));
                continue;
            }

            if (IPNetwork.TryParse(entry, out var network))
            {
                networks.Add(network);
                continue;
            }

            throw new InvalidOperationException(
                $"Invalid trusted proxy address or CIDR: '{entry}'.");
        }

        if (proxies.Count == 0 && networks.Count == 0)
            throw new InvalidOperationException("No valid trusted proxy entries were configured.");

        return new TrustedForwardingConfiguration(
            proxies.OrderBy(x => x.ToString(), StringComparer.Ordinal).ToArray(),
            networks.OrderBy(x => x.ToString(), StringComparer.Ordinal).ToArray());
    }

    private static IPAddress Normalize(IPAddress address) =>
        address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
}
