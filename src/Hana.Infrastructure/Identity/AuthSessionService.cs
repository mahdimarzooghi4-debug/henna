using Hana.Application.Time;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Identity;

/// <summary>
/// Stateful session lookup/revocation; bearer values are never persisted.
/// Account access is checked against the database on each lookup here.
/// </summary>
public sealed class AuthSessionService(
    HanaIdentityDbContext db,
    IClock clock)
{
    public async Task<Guid?> ResolveAccountAsync(
        string? bearerToken, CancellationToken cancellationToken = default)
    {
        if (!SessionTokenCodec.TryComputeDigest(bearerToken, out var digest))
            return null;

        var now = clock.UtcNow.ToUniversalTime();
        var active = await db.AuthSessions
            .FromSqlInterpolated($"""
                SELECT * FROM identity.auth_sessions
                WHERE token_digest = {digest}
                  AND revoked_at_utc IS NULL
                  AND issued_at_utc <= {now} AND expires_at_utc > {now}
                """)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);
        return active?.AccountId;
    }

    public async Task<bool> RevokeAsync(
        string? bearerToken, CancellationToken cancellationToken = default)
    {
        if (!SessionTokenCodec.TryComputeDigest(bearerToken, out var digest))
            return false;

        var now = clock.UtcNow.ToUniversalTime();
        var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE identity.auth_sessions SET revoked_at_utc = {now}
            WHERE token_digest = {digest}
              AND revoked_at_utc IS NULL
              AND issued_at_utc <= {now} AND expires_at_utc > {now}
            """, cancellationToken);
        return updated == 1;
    }
}
