namespace Hana.Infrastructure.Identity;

/// <summary>
/// Per-observed-IP OTP budget shared by all API replicas through PostgreSQL.
/// A keyed digest is stored instead of the client address. This deliberately
/// NEVER trusts arbitrary X-Forwarded-For headers from the Internet.
/// </summary>
public sealed class OtpIpRateWindowRecord
{
    public required byte[] PartitionDigest { get; set; }
    public required string Action { get; set; }
    public DateTimeOffset WindowStartedAtUtc { get; set; }
    public int RequestCount { get; set; }
}
