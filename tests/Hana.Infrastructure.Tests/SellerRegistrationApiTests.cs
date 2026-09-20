using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// CI-only: real ASP.NET routes + real PostgreSQL + seeded verified accounts.
/// Never register a token-minting or fake SMS endpoint in the shipping API.
/// </summary>
public sealed class SellerRegistrationApiTests
{
    [Fact]
    public async Task AuthenticatedDraftIsPersistedScopedEditableAndRevocable()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return; // CI configures real ephemeral PostgreSQL.

        var options = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var identity = new HanaIdentityDbContext(options);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var firstPhone = NewPhone();
        var secondPhone = NewPhone();
        // No OTP bypass: directly seed hashed sessions solely in disposable CI DB.
        var firstToken = SessionTokenCodec.Generate();
        var secondToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(firstToken, out var firstHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(secondToken, out var secondHash));

        identity.Accounts.AddRange(
            new AccountRecord
            {
                Id = firstId, NormalizedPhone = firstPhone,
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            },
            new AccountRecord
            {
                Id = secondId, NormalizedPhone = secondPhone,
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            });
        identity.AuthSessions.AddRange(
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = firstId, TokenDigest = firstHash,
                IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            },
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = secondId, TokenDigest = secondHash,
                IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            });
        await identity.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var anon = factory.CreateClient();
        using var first = factory.CreateClient();
        using var second = factory.CreateClient();
        first.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", firstToken);
        second.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", secondToken);
        const string url = "/api/v1/seller/registration";
        var draft = Fields(firstPhone, "فروشگاه اول");

        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await first.GetAsync(url)).StatusCode);

        var saved = await first.PutAsJsonAsync(url, draft);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal("no-store", saved.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(await saved.Content.ReadAsStringAsync()))
            Assert.Equal("DRAFT", body.RootElement.GetProperty("status").GetString());

        var owned = await first.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, owned.StatusCode);
        Assert.Equal("no-store", owned.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(await owned.Content.ReadAsStringAsync()))
        {
            Assert.Equal("فروشگاه اول",
                body.RootElement.GetProperty("storeName").GetString());
            Assert.Equal(firstPhone,
                body.RootElement.GetProperty("phone").GetString());
            Assert.Equal("DRAFT",
                body.RootElement.GetProperty("status").GetString());
            Assert.False(body.RootElement.TryGetProperty("accountId", out _));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await second.GetAsync(url)).StatusCode);

        // An otherwise authenticated user cannot replace their verified
        // account phone with a different number on this form.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await second.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await second.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, "invalid", "123"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, new string('X', 121)))).StatusCode);

        var updated = await first.PutAsJsonAsync(
            url, Fields(firstPhone, "فروشگاه ویرایش‌شده"));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await second.PutAsJsonAsync(
                url, Fields(secondPhone, "فروشگاه دوم"))).StatusCode);

        var one = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == firstId);
        var two = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == secondId);
        Assert.Equal("فروشگاه ویرایش‌شده", one.StoreName);
        Assert.Equal(firstPhone, one.Phone);
        Assert.Equal("فروشگاه دوم", two.StoreName);
        Assert.Equal(2, await seller.RegistrationDrafts.CountAsync(
            x => x.AccountId == firstId || x.AccountId == secondId));
        Assert.Equal("DRAFT", one.Status);
        Assert.Equal("DRAFT", two.Status);

        await identity.AuthSessions
            .Where(x => x.AccountId == firstId)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(x => x.RevokedAtUtc, DateTimeOffset.UtcNow));
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await first.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await second.GetAsync(url)).StatusCode);
    }

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);

    private static object Fields(string phone, string name,
        string postalCode = "1234567890") => new
        {
            storeName = name, ownerName = "مسئول",
            phone, city = "تهران", address = "نشانی آزمایشی",
            postalCode
        };
}
