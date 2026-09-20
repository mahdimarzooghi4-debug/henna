using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hana.Infrastructure.Catalog;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// Uses real ASP.NET routes and disposable CI PostgreSQL; all category and
/// product records are test-only. No shipping catalog demo seed exists.
/// </summary>
[Collection("CatalogDatabase")]
public sealed class CatalogReadApiTests
{
    [Fact]
    public async Task PublicReadReturnsOnlyPublishedProductsInPublishedCategories()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var options = new DbContextOptionsBuilder<HanaCatalogDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "catalog"))
            .Options;
        await using var db = new HanaCatalogDbContext(options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        // The whole API is public to read, but there is no anonymous
        // publishing or editing route and no consumer-price derivation.
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        const string categoriesUrl = "/api/v1/catalog/categories";
        const string productsUrl = "/api/v1/catalog/products";

        var initial = await client.GetAsync(productsUrl);
        Assert.Equal(HttpStatusCode.OK, initial.StatusCode);
        Assert.Equal("no-store",
            initial.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(await initial.Content.ReadAsStringAsync()))
        {
            Assert.Equal(0, body.RootElement.GetProperty("total").GetInt32());
            Assert.Equal(0, body.RootElement.GetProperty("items").GetArrayLength());
        }

        var now = DateTimeOffset.UtcNow;
        var liveCategory = Guid.NewGuid();
        var draftCategory = Guid.NewGuid();
        var liveProduct = Guid.NewGuid();
        var serviceProduct = Guid.NewGuid();
        var hiddenProduct = Guid.NewGuid();
        var hiddenByCategoryProduct = Guid.NewGuid();
        db.Categories.AddRange(
            new CategoryRecord
            {
                Id = liveCategory, Name = "آزمون گروه قابل مشاهده",
                Slug = "ci-live-" + liveCategory.ToString("N"),
                State = PublicationStates.Published, CreatedAtUtc = now
            },
            new CategoryRecord
            {
                Id = draftCategory, Name = "آزمون گروه مخفی",
                Slug = "ci-draft-" + draftCategory.ToString("N"),
                State = PublicationStates.Draft, CreatedAtUtc = now
            });
        db.Products.AddRange(
            NewProduct(liveProduct, liveCategory, "آزمون کالا ۵۰% ویژه",
                CatalogProductKinds.Good, PublicationStates.Published, now),
            NewProduct(serviceProduct, liveCategory, "آزمون خدمت حنا",
                CatalogProductKinds.Service, PublicationStates.Published, now),
            NewProduct(hiddenProduct, liveCategory, "آزمون کالای پیش‌نویس",
                CatalogProductKinds.Good, PublicationStates.Draft, now),
            NewProduct(hiddenByCategoryProduct, draftCategory,
                "آزمون کالای زیر گروه مخفی", CatalogProductKinds.Good,
                PublicationStates.Published, now));
        await db.SaveChangesAsync();

        var categories = await client.GetFromJsonAsync<JsonElement>(categoriesUrl);
        var visibleCategories = categories.GetProperty("items")
            .EnumerateArray().ToArray();
        Assert.Contains(visibleCategories, x =>
            x.GetProperty("id").GetGuid() == liveCategory);
        Assert.DoesNotContain(visibleCategories, x =>
            x.GetProperty("id").GetGuid() == draftCategory);

        var listing = await client.GetFromJsonAsync<JsonElement>(
            productsUrl + "?categoryId=" + liveCategory);
        Assert.Equal(2, listing.GetProperty("total").GetInt32());
        Assert.Equal(2, listing.GetProperty("items").GetArrayLength());
        Assert.Equal(1, listing.GetProperty("page").GetInt32());
        Assert.Equal(20, listing.GetProperty("pageSize").GetInt32());
        Assert.DoesNotContain(listing.GetProperty("items").EnumerateArray(),
            x => x.GetProperty("id").GetGuid() == hiddenProduct);
        Assert.DoesNotContain(listing.GetProperty("items").EnumerateArray(),
            x => x.GetProperty("id").GetGuid() == hiddenByCategoryProduct);
        Assert.All(listing.GetProperty("items").EnumerateArray(), x =>
        {
            Assert.False(x.TryGetProperty("price", out _));
            Assert.False(x.TryGetProperty("sellerId", out _));
            Assert.False(x.TryGetProperty("stock", out _));
            Assert.False(x.TryGetProperty("state", out _));
        });

        var exact = await client.GetFromJsonAsync<JsonElement>(
            productsUrl + "/" + liveProduct);
        Assert.Equal(liveProduct, exact.GetProperty("id").GetGuid());
        Assert.Equal("GOOD", exact.GetProperty("kind").GetString());
        Assert.False(exact.TryGetProperty("price", out _));

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync(productsUrl + "/" + hiddenProduct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync(productsUrl + "/" + hiddenByCategoryProduct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync(productsUrl + "/" + Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync(productsUrl + "/" + Guid.Empty)).StatusCode);

        var search = await client.GetFromJsonAsync<JsonElement>(
            productsUrl + "?categoryId=" + liveCategory + "&search=%25");
        Assert.Equal(1, search.GetProperty("total").GetInt32());
        Assert.Equal(liveProduct, search.GetProperty("items")[0]
            .GetProperty("id").GetGuid());
        var pageTwo = await client.GetFromJsonAsync<JsonElement>(
            productsUrl + "?categoryId=" + liveCategory + "&page=2&pageSize=1");
        Assert.Equal(2, pageTwo.GetProperty("total").GetInt32());
        Assert.Equal(1, pageTwo.GetProperty("items").GetArrayLength());
        Assert.Equal(2, pageTwo.GetProperty("page").GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync(productsUrl + "?pageSize=51")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync(productsUrl + "?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync(productsUrl + "?categoryId=" + Guid.Empty)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync(productsUrl + "?search=" + new string('x', 81))).StatusCode);

        // After moderation is withdrawn, existing URLs stop exposing the
        // product, even though the row is still present in PostgreSQL.
        await db.Categories.Where(x => x.Id == liveCategory)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(x => x.State, PublicationStates.Draft));
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync(productsUrl + "/" + liveProduct)).StatusCode);
        var unpublished = await client.GetFromJsonAsync<JsonElement>(
            productsUrl + "?categoryId=" + liveCategory);
        Assert.Equal(0, unpublished.GetProperty("total").GetInt32());
    }

    private static ProductRecord NewProduct(
        Guid id, Guid categoryId, string name, string kind,
        string state, DateTimeOffset created) => new()
    {
        Id = id, CategoryId = categoryId, Name = name,
        Description = "شرح آزمایشی بدون قیمت و پیشنهاد فروشنده",
        Kind = kind, State = state, CreatedAtUtc = created
    };
}
