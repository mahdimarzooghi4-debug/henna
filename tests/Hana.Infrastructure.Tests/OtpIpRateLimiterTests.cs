using System.Net;
using System.Security.Cryptography;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class OtpIpRateLimiterTests
{
    private static DbContextOptions<HanaIdentityDbContext>? Options()
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        return string.IsNullOrWhiteSpace(cs) ? null :
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(cs).Options;
    }

    [Fact]
    public async Task ConcurrentRequestsAcrossContextsShareExactlyThreePermits()
    {
        var options = Options();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var ip = IPAddress.Parse("203.0.113.17");

        async Task<bool> Request()
        {
            await using var db = new HanaIdentityDbContext(options);
            return await new OtpIpRateLimiter(db, crypto)
                .AllowAsync(ip, OtpIpAction.Request);
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 20)
            .Select(_ => Request()));
        Assert.Equal(OtpIpRateLimiter.RequestLimit, results.Count(x => x));
        Assert.Equal(20 - OtpIpRateLimiter.RequestLimit, results.Count(x => !x));
    }

    [Fact]
    public async Task RequestAndVerifyHaveSeparateBudgetsAndIpPartitions()
    {
        var options = Options();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var first = IPAddress.Parse("203.0.113.18");
        var second = IPAddress.Parse("203.0.113.19");
        await using var db = new HanaIdentityDbContext(options);
        var limiter = new OtpIpRateLimiter(db, crypto);

        for (var i = 0; i < OtpIpRateLimiter.RequestLimit; i++)
            Assert.True(await limiter.AllowAsync(first, OtpIpAction.Request));
        Assert.False(await limiter.AllowAsync(first, OtpIpAction.Request));

        for (var i = 0; i < OtpIpRateLimiter.VerifyLimit; i++)
            Assert.True(await limiter.AllowAsync(first, OtpIpAction.Verify));
        Assert.False(await limiter.AllowAsync(first, OtpIpAction.Verify));
        Assert.True(await limiter.AllowAsync(second, OtpIpAction.Request));
    }

    [Fact]
    public async Task Ipv4MappedIpv6CannotDoubleBudgetAndUnknownIpSharesOneBucket()
    {
        var options = Options();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        await using var db = new HanaIdentityDbContext(options);
        var limiter = new OtpIpRateLimiter(db, crypto);
        var v4 = IPAddress.Parse("203.0.113.20");
        var mapped = IPAddress.Parse("::ffff:203.0.113.20");

        for (var i = 0; i < OtpIpRateLimiter.RequestLimit; i++)
            Assert.True(await limiter.AllowAsync(i % 2 == 0 ? v4 : mapped,
                OtpIpAction.Request));
        Assert.False(await limiter.AllowAsync(mapped, OtpIpAction.Request));

        for (var i = 0; i < OtpIpRateLimiter.RequestLimit; i++)
            Assert.True(await limiter.AllowAsync(null, OtpIpAction.Request));
        Assert.False(await limiter.AllowAsync(null, OtpIpAction.Request));
    }

    [Fact]
    public async Task ExpiredWindowResetsUsingPostgresClock()
    {
        var options = Options();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var ip = IPAddress.Parse("203.0.113.21");
        await using var db = new HanaIdentityDbContext(options);
        var limiter = new OtpIpRateLimiter(db, crypto);
        for (var i = 0; i < OtpIpRateLimiter.RequestLimit; i++)
            Assert.True(await limiter.AllowAsync(ip, OtpIpAction.Request));
        Assert.False(await limiter.AllowAsync(ip, OtpIpAction.Request));

        var digest = crypto.ComputeClientIpDigest(ip.ToString(), "REQUEST");
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE identity.otp_ip_windows
            SET window_started_at_utc = now() - interval '61 seconds'
            WHERE partition_digest = {digest} AND action = {"REQUEST"}
            """);

        Assert.True(await limiter.AllowAsync(ip, OtpIpAction.Request));
        Assert.True(await limiter.AllowAsync(ip, OtpIpAction.Request));
        Assert.True(await limiter.AllowAsync(ip, OtpIpAction.Request));
        Assert.False(await limiter.AllowAsync(ip, OtpIpAction.Request));
    }

    [Fact]
    public async Task PersistedPartitionIsKeyedDigestAndOldWindowsArePruned()
    {
        var options = Options();
        if (options is null) return;
        var crypto = new OtpCodeCryptography(RandomNumberGenerator.GetBytes(32));
        var ip = IPAddress.Parse("203.0.113.22");
        await using var db = new HanaIdentityDbContext(options);
        var limiter = new OtpIpRateLimiter(db, crypto);
        Assert.True(await limiter.AllowAsync(ip, OtpIpAction.Request));

        var digest = crypto.ComputeClientIpDigest(ip.ToString(), "REQUEST");
        Assert.Equal(32, digest.Length);
        Assert.NotEqual(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(ip.ToString())),
            digest);
        var stored = await db.OtpIpRateWindows.AsNoTracking()
            .SingleAsync(x => x.PartitionDigest == digest &&
                x.Action == "REQUEST");
        Assert.Equal(1, stored.RequestCount);

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE identity.otp_ip_windows
            SET window_started_at_utc = now() - interval '2 days'
            WHERE partition_digest = {digest} AND action = {"REQUEST"}
            """);
        Assert.True(await limiter.PruneAsync() >= 1);
        Assert.False(await db.OtpIpRateWindows.AsNoTracking()
            .AnyAsync(x => x.PartitionDigest == digest &&
                x.Action == "REQUEST"));
    }
}
