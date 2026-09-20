using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class IdentitySchemaTests
{
    [Fact]
    public async Task MigrationsCreateBothIdentityTablesAndUniquePhoneIndex()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            return; // Local unit-only runs can omit a DB; CI requires PostgreSQL.

        var options = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connectionString).Options;
        await using var db = new HanaIdentityDbContext(options);

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var tables = await db.Database.SqlQueryRaw<int>(
            """
            SELECT count(*)::integer AS "Value"
            FROM information_schema.tables
            WHERE table_schema='identity'
              AND table_name IN ('accounts','otp_challenges','auth_sessions','otp_ip_windows')
            """).SingleAsync();
        Assert.Equal(4, tables);

        var indexes = await db.Database.SqlQueryRaw<int>(
            """
            SELECT count(*)::integer AS "Value"
            FROM pg_indexes
            WHERE schemaname='identity'
              AND indexname='ix_accounts_normalized_phone'
              AND indexdef ILIKE '%UNIQUE%'
            """).SingleAsync();
        Assert.Equal(1, indexes);

        var deliveryColumn = await db.Database.SqlQueryRaw<int>(
            """
            SELECT count(*)::integer AS "Value"
            FROM information_schema.columns
            WHERE table_schema='identity' AND table_name='otp_challenges'
              AND column_name='delivery_status'
            """).SingleAsync();
        Assert.Equal(1, deliveryColumn);
    }

    [Fact]
    public async Task AccountsAndChallengesAreNotPaymentOrCreditData()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var options = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connectionString).Options;
        await using var db = new HanaIdentityDbContext(options);

        var identityTables = await db.Database.SqlQueryRaw<string>(
            """
            SELECT table_name AS "Value"
            FROM information_schema.tables
            WHERE table_schema='identity' AND table_type='BASE TABLE'
            ORDER BY table_name
            """).ToListAsync();

        Assert.Equal(new[] { "accounts", "auth_sessions", "otp_challenges", "otp_ip_windows" }, identityTables);
    }
}
