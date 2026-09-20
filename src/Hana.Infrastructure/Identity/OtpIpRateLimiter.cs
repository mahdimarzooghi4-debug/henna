using System.Net;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Hana.Infrastructure.Identity;

public enum OtpIpAction
{
    Request,
    Verify
}

/// <summary>
/// PostgreSQL atomic UPSERT enforces a 60-second IP window across replicas.
/// Database clock avoids clock skew between API hosts; failures must fail closed.
/// </summary>
public sealed class OtpIpRateLimiter(
    HanaIdentityDbContext db, OtpCodeCryptography crypto)
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    public const int RequestLimit = 3;
    public const int VerifyLimit = 5;

    public async Task<bool> AllowAsync(
        IPAddress? observedAddress, OtpIpAction action,
        CancellationToken cancellationToken = default)
    {
        var name = action switch
        {
            OtpIpAction.Request => "REQUEST",
            OtpIpAction.Verify => "VERIFY",
            _ => throw new ArgumentOutOfRangeException(nameof(action))
        };
        var max = action == OtpIpAction.Request ? RequestLimit : VerifyLimit;
        // Unknown IP shares one conservative bucket. Normalize IPv4-mapped
        // IPv6 so it cannot double its budget through alternate text forms.
        var ip = observedAddress is null ? "unknown"
            : observedAddress.IsIPv4MappedToIPv6
                ? observedAddress.MapToIPv4().ToString()
                : observedAddress.ToString();
        var digest = crypto.ComputeClientIpDigest(ip, name);
        var saturatedCount = max + 1;

        // ON CONFLICT obtains a row lock: two different API instances cannot
        // independently admit the last permit. No in-process counters or
        // spoofable client-provided headers are used. "Value" is EF's scalar
        // result alias; the DB clock, not client time, starts/resets windows.
        await db.Database.OpenConnectionAsync(cancellationToken);
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            INSERT INTO identity.otp_ip_windows
                (partition_digest, action, window_started_at_utc, request_count)
            VALUES (@digest, @action, now(), 1)
            ON CONFLICT (partition_digest, action)
            DO UPDATE SET
                request_count = CASE
                    WHEN otp_ip_windows.window_started_at_utc <=
                        now() - interval '60 seconds' THEN 1
                    ELSE LEAST(otp_ip_windows.request_count + 1, @saturation)
                END,
                window_started_at_utc = CASE
                    WHEN otp_ip_windows.window_started_at_utc <=
                        now() - interval '60 seconds' THEN now()
                    ELSE otp_ip_windows.window_started_at_utc
                END
            RETURNING request_count
            """;
        command.Parameters.Add(new NpgsqlParameter("digest", NpgsqlDbType.Bytea)
            { Value = digest });
        command.Parameters.Add(new NpgsqlParameter("action", NpgsqlDbType.Varchar)
            { Value = name });
        command.Parameters.Add(new NpgsqlParameter("saturation", NpgsqlDbType.Integer)
            { Value = saturatedCount });
        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        if (scalar is not int count)
            throw new InvalidOperationException("OTP IP rate window was not persisted.");

        // Best-effort bounded retention, using DB time and an indexed cutoff.
        // A failure propagates and the API returns 503, not a false allowance.
        if (RandomNumberGenerator.GetInt32(256) == 0)
            await PruneAsync(cancellationToken);

        return count <= max;
    }

    public Task<int> PruneAsync(CancellationToken cancellationToken = default) =>
        db.Database.ExecuteSqlRawAsync(
            "DELETE FROM identity.otp_ip_windows WHERE window_started_at_utc < now() - interval '1 day'",
            cancellationToken);
}
