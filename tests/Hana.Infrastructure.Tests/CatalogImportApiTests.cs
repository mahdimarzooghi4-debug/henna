using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Infrastructure.Catalog;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// Disposable CI Postgres and actual public API. No fixture import in shipping code.
/// Serialized with CatalogReadApiTests to isolate the shared CI database.
/// </summary>
[Collection("CatalogDatabase")]
public sealed class CatalogImportApiTests
{
    [Fact]
    public async Task OperatorPreviewApplyAndWithdrawAreAtomicAndIdempotent()
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

        var categoryId = Guid.NewGuid();
        var hiddenCategoryId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var hiddenProductId = Guid.NewGuid();
        var slug = "ci-approved-" + categoryId.ToString("N");
        var hiddenSlug = "ci-hidden-" + hiddenCategoryId.ToString("N");
        var categories = new[]
        {
            Category(categoryId, slug, "گروه مورد تأیید", "PUBLISHED"),
            Category(hiddenCategoryId, hiddenSlug, "گروه پیش‌نویس", "DRAFT")
        };
        var products = new[]
        {
            Product(productId, categoryId, "کالای معتبر CI", "GOOD",
                "PUBLISHED", "توضیح قابل انتشار"),
            Product(hiddenProductId, hiddenCategoryId, "خدمت مخفی CI",
                "SERVICE", "PUBLISHED", null)
        };
        var initialJson = Document(categories, products);
        var appliedDigests = new HashSet<string>(StringComparer.Ordinal);
        var initialDigest = Convert.ToHexStringLower(
            SHA256.HashData(Encoding.UTF8.GetBytes(initialJson)));
        var now = DateTimeOffset.UtcNow;

        async Task<CatalogImportResult> Import(
            string document, bool dryRun,
            string? expectedDbStateSha256 = null,
            Action<string>? onDbStateObserved = null)
        {
            await using var scoped = new HanaCatalogDbContext(options);
            var result = await CatalogImportService.ImportAsync(
                scoped, document, now, dryRun,
                expectedDbStateSha256: expectedDbStateSha256,
                onDbStateObserved: onDbStateObserved);
            if (!dryRun)
                appliedDigests.Add(Convert.ToHexStringLower(
                    SHA256.HashData(Encoding.UTF8.GetBytes(document))));
            return result;
        }

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        var detail = "/api/v1/catalog/products/" + productId;

        try
        {
            string? reviewedDbState = null;
            var preview = await Import(initialJson, dryRun: true,
                onDbStateObserved: hash => reviewedDbState = hash);
            Assert.Equal(64, reviewedDbState?.Length);
            Assert.Equal(new CatalogImportResult(2, 0, 2, 0, true), preview);
            Assert.False(await db.Categories.AsNoTracking().AnyAsync(
                x => x.Id == categoryId || x.Id == hiddenCategoryId));
            Assert.Equal(0, await db.ImportReceipts.AsNoTracking()
                .CountAsync(x => x.ContentSha256 == initialDigest));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(detail)).StatusCode);

            var applied = await Import(initialJson, dryRun: false,
                expectedDbStateSha256: reviewedDbState);
            Assert.Equal(new CatalogImportResult(2, 0, 2, 0, false), applied);
            // Same bytes but changed persisted identity: prior preview is
            // stale; no extra receipt or row mutation.
            await Assert.ThrowsAsync<InvalidDataException>(() => Import(
                initialJson, dryRun: false,
                expectedDbStateSha256: reviewedDbState));
            var stable = await Import(initialJson, dryRun: false);
            Assert.Equal(new CatalogImportResult(0, 0, 0, 0, false), stable);
            Assert.Equal(2, await db.Categories.AsNoTracking().CountAsync(
                x => x.Id == categoryId || x.Id == hiddenCategoryId));
            Assert.Equal(2, await db.Products.AsNoTracking().CountAsync(
                x => x.Id == productId || x.Id == hiddenProductId));
            var receipts = await db.ImportReceipts.AsNoTracking()
                .Where(x => x.ContentSha256 == initialDigest)
                .OrderBy(x => x.AppliedAtUtc).ThenBy(x => x.Id)
                .ToListAsync();
            Assert.Equal(2, receipts.Count);
            Assert.All(receipts, x =>
            {
                Assert.NotEqual(Guid.Empty, x.Id);
                Assert.Equal(initialDigest, x.ContentSha256);
                Assert.True(x.AppliedAtUtc > DateTimeOffset.UtcNow.AddMinutes(-5));
                Assert.True(x.AppliedAtUtc <= DateTimeOffset.UtcNow.AddMinutes(1));
            });
            Assert.Contains(receipts, x => x.NewParents == 2 &&
                x.NewChildren == 2 &&
                x.ChangedParents == 0 && x.ChangedChildren == 0);
            Assert.Contains(receipts, x =>
                x.NewParents == 0 && x.ChangedParents == 0 &&
                x.NewChildren == 0 && x.ChangedChildren == 0);
            var visible = await client.GetAsync(detail);
            Assert.Equal(HttpStatusCode.OK, visible.StatusCode);
            using (var result = JsonDocument.Parse(
                await visible.Content.ReadAsStringAsync()))
            {
                Assert.Equal("کالای معتبر CI",
                    result.RootElement.GetProperty("name").GetString());
                Assert.False(result.RootElement.TryGetProperty("state", out _));
                Assert.False(result.RootElement.TryGetProperty("price", out _));
            }
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync("/api/v1/catalog/products/" +
                    hiddenProductId)).StatusCode);

            // All validation completes before mutating the first entity.
            var unknownCategory = Guid.NewGuid();
            var invalid = Document(
                [Category(categoryId, slug, "تغییر نام نباید ذخیره شود",
                    "PUBLISHED")],
                [Product(Guid.NewGuid(), unknownCategory,
                    "کالای با گروه ناموجود", "GOOD", "PUBLISHED", null)]);
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(invalid, dryRun: false));
            Assert.Equal("گروه مورد تأیید",
                (await db.Categories.AsNoTracking().SingleAsync(
                    x => x.Id == categoryId)).Name);
            Assert.Equal(2, await db.Products.AsNoTracking().CountAsync(
                x => x.Id == productId || x.Id == hiddenProductId));

            // Schema is strict: importer is not an offer/price/stock backdoor.
            var extraField = initialJson.Replace(
                "\"kind\":\"GOOD\"", "\"kind\":\"GOOD\",\"price\":123");
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(extraField, dryRun: false));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document(categories,
                    [products[0], products[0]]), dryRun: false));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document(categories,
                    [Product(productId, categoryId, "کالای تغییرنوع",
                        "SERVICE", "PUBLISHED", null)]), dryRun: false));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document(
                    [Category(Guid.NewGuid(), slug, "slug تکراری",
                        "PUBLISHED")], []), dryRun: false));

            Assert.Equal(2, await db.ImportReceipts.AsNoTracking()
                .CountAsync(x => x.ContentSha256 == initialDigest));
            // Explicit withdrawal is reversible; omissions don't auto-delete.
            var withdrawn = await Import(Document([],
                [Product(productId, categoryId, "کالای معتبر CI",
                    "GOOD", "DRAFT", "توضیح قابل انتشار")]),
                dryRun: false);
            Assert.Equal(1, withdrawn.ChangedProducts);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(detail)).StatusCode);
            Assert.Equal(2, await db.Products.AsNoTracking().CountAsync(
                x => x.Id == productId || x.Id == hiddenProductId));

            await Import(Document([],
                [Product(productId, categoryId, "کالای معتبر CI",
                    "GOOD", "PUBLISHED", "توضیح قابل انتشار")]),
                dryRun: false);
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(detail)).StatusCode);

            await Import(Document(
                [Category(categoryId, slug, "گروه مورد تأیید", "DRAFT")], []),
                dryRun: false);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(detail)).StatusCode);
            await Import(Document(
                [Category(categoryId, slug, "گروه مورد تأیید", "PUBLISHED")],
                []), dryRun: false);
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(detail)).StatusCode);
        }
        finally
        {
            // Production receipts remain append-only; only CI test fixtures
            // are cleaned from disposable CI PostgreSQL by unique content hash.
            await db.ImportReceipts.Where(x =>
                appliedDigests.Contains(x.ContentSha256))
                .ExecuteDeleteAsync();
            await db.Products.Where(x =>
                x.Id == productId || x.Id == hiddenProductId)
                .ExecuteDeleteAsync();
            await db.Categories.Where(x =>
                x.Id == categoryId || x.Id == hiddenCategoryId)
                .ExecuteDeleteAsync();
        }
    }

    private static object Category(
        Guid id, string slug, string name, string state) =>
        new { id, slug, name, state };

    private static object Product(Guid id, Guid categoryId, string name,
        string kind, string state, string? description) =>
        new { id, categoryId, name, kind, state, description };

    private static string Document(
        object[] categories, object[] products) =>
        JsonSerializer.Serialize(new { categories, products });
}
