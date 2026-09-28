using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Hana.Infrastructure.Buyer;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Hana.Infrastructure.Tests;

[Collection("CatalogDatabase")]
public sealed class BuyerReferenceCartApiTests
{
    [Fact]
    public async Task CartIsAccountScopedAndUsesPublishedGoodUnitAndRevisionCas()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var buyerOptions = new DbContextOptionsBuilder<HanaBuyerDbContext>()
            .UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "buyer")).Options;
        var catalogOptions = new DbContextOptionsBuilder<HanaCatalogDbContext>()
            .UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "catalog")).Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var buyer = new HanaBuyerDbContext(buyerOptions);
        await using var catalog = new HanaCatalogDbContext(catalogOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await buyer.Database.GetPendingMigrationsAsync());
        Assert.Empty(await catalog.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var otherAccountId = Guid.NewGuid();
        var token = SessionTokenCodec.Generate();
        var otherToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(token, out var digest));
        Assert.True(SessionTokenCodec.TryComputeDigest(otherToken, out var otherDigest));
        identity.Accounts.AddRange(Account(accountId, now), Account(otherAccountId, now));
        identity.AuthSessions.AddRange(Session(accountId, digest, now), Session(otherAccountId, otherDigest, now));
        var categoryId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        catalog.Categories.Add(new CategoryRecord
        { Id = categoryId, Name = "واحد آزمون سبد", Slug = "buyer-cart-" + categoryId.ToString("N"), State = PublicationStates.Published, CreatedAtUtc = now });
        catalog.Products.AddRange(
            Product(goodId, categoryId, CatalogProductKinds.Good, "کیلوگرم", 1, now),
            Product(serviceId, categoryId, CatalogProductKinds.Service, null, null, now));
        await identity.SaveChangesAsync();
        await catalog.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var client = factory.CreateClient();
        using var other = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/v1/buyer/cart")).StatusCode);
        var empty = await client.GetFromJsonAsync<JsonElement>("/api/v1/buyer/cart");
        Assert.Equal(0, empty.GetProperty("revision").GetInt64());
        Assert.Equal(0, empty.GetProperty("items").GetArrayLength());

        var precision = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{goodId}", new { revision = 0, quantity = 2.55m });
        Assert.Equal(HttpStatusCode.BadRequest, precision.StatusCode);
        var service = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{serviceId}", new { revision = 0, quantity = 1m });
        Assert.Equal(HttpStatusCode.NotFound, service.StatusCode);
        var added = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{goodId}", new { revision = 0, quantity = 2.5m });
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        var cart = await added.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, cart.GetProperty("revision").GetInt64());
        Assert.Equal(2.5m, cart.GetProperty("items")[0].GetProperty("quantity").GetDecimal());
        Assert.Equal("کیلوگرم", cart.GetProperty("items")[0].GetProperty("unitName").GetString());

        var replay = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{goodId}", new { revision = 0, quantity = 2.5m });
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(1, (await replay.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("revision").GetInt64());

        var stale = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{goodId}", new { revision = 0, quantity = 1m });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var otherCart = await other.GetFromJsonAsync<JsonElement>("/api/v1/buyer/cart");
        Assert.Equal(0, otherCart.GetProperty("revision").GetInt64());
        Assert.Equal(0, otherCart.GetProperty("items").GetArrayLength());
        var removed = await client.DeleteAsync($"/api/v1/buyer/cart/items/{goodId}?revision=1");
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        var final = await removed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, final.GetProperty("revision").GetInt64());
        Assert.Equal(0, final.GetProperty("items").GetArrayLength());
        var removeReplay = await client.DeleteAsync($"/api/v1/buyer/cart/items/{goodId}?revision=1");
        Assert.Equal(HttpStatusCode.OK, removeReplay.StatusCode);
        Assert.Equal(2, (await removeReplay.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("revision").GetInt64());
        Assert.False(await identity.RoleAssignments.AnyAsync(x => x.AccountId == accountId));
    }

    [Fact]
    public void BuyerMigrationSnapshotMatchesCurrentModel()
    {
        var options = new DbContextOptionsBuilder<HanaBuyerDbContext>()
            .UseNpgsql("Host=localhost;Database=buyer_snapshot_check", pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "buyer"))
            .Options;
        using var db = new HanaBuyerDbContext(options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var finalized = db.GetService<IModelRuntimeInitializer>().Initialize(snapshot.Model, designTime: true);
        Assert.Empty(db.GetService<IMigrationsModelDiffer>().GetDifferences(finalized.GetRelationalModel(), current.GetRelationalModel()));
    }

    private static AccountRecord Account(Guid id, DateTimeOffset now) => new()
    { Id = id, NormalizedPhone = "09" + Random.Shared.NextInt64(0, 999_999_999).ToString("D9"), CreatedAtUtc = now };
    private static AuthSessionRecord Session(Guid accountId, byte[] digest, DateTimeOffset now) => new()
    { Id = Guid.NewGuid(), AccountId = accountId, TokenDigest = digest, IssuedAtUtc = now.AddMinutes(-1), ExpiresAtUtc = now.AddHours(1) };
    private static ProductRecord Product(Guid id, Guid categoryId, string kind, string? unit, short? scale, DateTimeOffset now) => new()
    { Id = id, CategoryId = categoryId, Name = "آزمون سبد " + id.ToString("N"), Kind = kind, State = PublicationStates.Published, UnitName = unit, QuantityScale = scale, CreatedAtUtc = now };
}
