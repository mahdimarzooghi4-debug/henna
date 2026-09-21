using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Net.Http.Json;
using System.Text.Json;
using Hana.Infrastructure.Geography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// Real API + disposable CI PostgreSQL; all location identities here are
/// test-only and removed. No shipping city or commercial coverage is seeded.
/// </summary>
[Collection("GeographyDatabase")]
public sealed class GeographyImportApiTests
{
    [Fact]
    public async Task ReviewedGeographyPreviewApplyAndWithdrawalAreSafe()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var options = new DbContextOptionsBuilder<HanaGeographyDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "geography"))
            .Options;
        await using var db = new HanaGeographyDbContext(options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var provinceId = Guid.NewGuid();
        var otherProvinceId = Guid.NewGuid();
        var cityId = Guid.NewGuid();
        var draftCityId = Guid.NewGuid();
        var otherCityId = Guid.NewGuid();
        var provinceSlug = "ci-operator-" + provinceId.ToString("N");
        var otherSlug = "ci-operator-" + otherProvinceId.ToString("N");
        var first = Province(provinceId, "استان آزمون", provinceSlug,
            GeographyStates.Selectable);
        var second = Province(otherProvinceId, "استان دوم", otherSlug,
            GeographyStates.Draft);
        var city = City(cityId, provinceId, "شهر آزمون", "same-city",
            GeographyStates.Selectable);
        var draftCity = City(draftCityId, provinceId, "شهر پیش‌نویس",
            "ci-draft-city", GeographyStates.Draft);
        var otherCity = City(otherCityId, otherProvinceId, "شهر استان دوم",
            "same-city", GeographyStates.Selectable);
        var json = Document([first, second],
            [city, draftCity, otherCity]);
        var appliedDigests = new HashSet<string>(StringComparer.Ordinal);
        var initialDigest = Convert.ToHexStringLower(
            SHA256.HashData(Encoding.UTF8.GetBytes(json)));

        async Task<GeographyImportResult> Import(
            string document, bool dryRun = false,
            string? expectedDbStateSha256 = null,
            Action<string>? onDbStateObserved = null)
        {
            await using var scoped = new HanaGeographyDbContext(options);
            var result = await GeographyImportService.ImportAsync(
                scoped, document, dryRun,
                expectedDbStateSha256: expectedDbStateSha256,
                onDbStateObserved: onDbStateObserved);
            if (!dryRun)
                appliedDigests.Add(Convert.ToHexStringLower(
                    SHA256.HashData(Encoding.UTF8.GetBytes(document))));
            return result;
        }

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        var provincesUrl = "/api/v1/geography/provinces";
        var cityUrl = "/api/v1/geography/cities";
        try
        {
            string? reviewedDbState = null;
            Assert.Equal(new GeographyImportResult(2, 0, 3, 0, true),
                await Import(json, dryRun: true,
                    onDbStateObserved: hash => reviewedDbState = hash));
            Assert.Equal(64, reviewedDbState?.Length);
            Assert.False(await db.Provinces.AsNoTracking().AnyAsync(
                x => x.Id == provinceId || x.Id == otherProvinceId));
            Assert.Equal(0, await db.ImportReceipts.AsNoTracking()
                .CountAsync(x => x.ContentSha256 == initialDigest));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);

            Assert.Equal(new GeographyImportResult(2, 0, 3, 0, false),
                await Import(json,
                    expectedDbStateSha256: reviewedDbState));
            await Assert.ThrowsAsync<InvalidDataException>(() => Import(
                json, expectedDbStateSha256: reviewedDbState));
            Assert.Equal(new GeographyImportResult(0, 0, 0, 0, false),
                await Import(json));
            Assert.Equal(2, await db.Provinces.AsNoTracking().CountAsync(
                x => x.Id == provinceId || x.Id == otherProvinceId));
            Assert.Equal(3, await db.Cities.AsNoTracking().CountAsync(
                x => x.Id == cityId || x.Id == draftCityId ||
                     x.Id == otherCityId));
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
                x.NewChildren == 3 &&
                x.ChangedParents == 0 && x.ChangedChildren == 0);
            Assert.Contains(receipts, x =>
                x.NewParents == 0 && x.ChangedParents == 0 &&
                x.NewChildren == 0 && x.ChangedChildren == 0);

            var provinces = await client.GetFromJsonAsync<JsonElement>(
                provincesUrl);
            var items = provinces.GetProperty("items").EnumerateArray().ToArray();
            Assert.Contains(items, x =>
                x.GetProperty("id").GetGuid() == provinceId);
            Assert.DoesNotContain(items, x =>
                x.GetProperty("id").GetGuid() == otherProvinceId);
            var detail = await client.GetFromJsonAsync<JsonElement>(
                cityUrl + "/" + cityId);
            Assert.Equal(cityId, detail.GetProperty("id").GetGuid());
            Assert.False(detail.TryGetProperty("state", out _));
            Assert.False(detail.TryGetProperty("deliveryAvailable", out _));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" +
                    draftCityId)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" +
                    otherCityId)).StatusCode);

            // An invalid final row must not partially mutate an earlier
            // imported row; the whole batch is rejected before saving.
            var missingProvince = Guid.NewGuid();
            await Assert.ThrowsAsync<InvalidDataException>(() => Import(
                Document(
                    [Province(provinceId, "نباید ثبت شود", provinceSlug,
                        GeographyStates.Selectable)],
                    [City(Guid.NewGuid(), missingProvince,
                        "گروه ناموجود", "orphan", GeographyStates.Selectable)])));
            Assert.Equal("استان آزمون",
                (await db.Provinces.AsNoTracking().SingleAsync(
                    x => x.Id == provinceId)).Name);

            // Reject duplicate publication fields even when an escaped
            // property name hides the duplicate from a casual file review.
            var ambiguousState = json.Replace(
                "\"state\":\"SELECTABLE\"",
                "\"state\":\"SELECTABLE\",\"state\":\"DRAFT\"",
                StringComparison.Ordinal);
            Assert.NotEqual(json, ambiguousState);
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(ambiguousState, dryRun: true));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(ambiguousState));
            var escapedState = json.Replace(
                "\"state\":\"SELECTABLE\"",
                "\"state\":\"SELECTABLE\",\"st\\u0061te\":\"DRAFT\"",
                StringComparison.Ordinal);
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(escapedState));
            Assert.Equal("استان آزمون",
                (await db.Provinces.AsNoTracking().SingleAsync(
                    x => x.Id == provinceId)).Name);
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);

            // Unknown attributes cannot become a backdoor for commerce,
            // delivery flags, price, provider, or launch activation.
            var extraField = json.Replace(
                "\"slug\":\"" + provinceSlug + "\"",
                "\"slug\":\"" + provinceSlug +
                    "\",\"cityLaunchReady\":true");
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(extraField));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([first, first], [])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([], [city, city])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([], [
                    City(Guid.NewGuid(), provinceId, "slug تکراری",
                        "same-city", GeographyStates.Selectable)
                ])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([
                    Province(Guid.NewGuid(), "slug استان تکراری",
                        provinceSlug, GeographyStates.Selectable)
                ], [])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([], [
                    City(cityId, otherProvinceId, "انتقال شهر",
                        "reparent-city", GeographyStates.Selectable)
                ])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([], [
                    City(Guid.NewGuid(), provinceId, "وضعیت نامجاز",
                        "invalid-state", "LAUNCHED")
                ])));
            await Assert.ThrowsAsync<InvalidDataException>(
                () => Import(Document([], [])));

            Assert.Equal(2, await db.ImportReceipts.AsNoTracking()
                .CountAsync(x => x.ContentSha256 == initialDigest));
            // Merely omitting an existing province/city does not delete,
            // withdraw or re-parent that city.
            Assert.Equal(new GeographyImportResult(0, 1, 0, 0, false),
                await Import(Document([
                    Province(provinceId, "استان آزمون", provinceSlug,
                        GeographyStates.Draft)
                ], [])));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);
            Assert.Equal(3, await db.Cities.AsNoTracking().CountAsync(
                x => x.Id == cityId || x.Id == draftCityId ||
                     x.Id == otherCityId));
            Assert.Equal(new GeographyImportResult(0, 1, 0, 0, false),
                await Import(Document([
                    Province(provinceId, "استان آزمون", provinceSlug,
                        GeographyStates.Selectable)
                ], [])));
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);

            Assert.Equal(new GeographyImportResult(0, 0, 0, 1, false),
                await Import(Document([], [
                    City(cityId, provinceId, "شهر آزمون", "same-city",
                        GeographyStates.Draft)
                ])));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);
            Assert.Equal(new GeographyImportResult(0, 0, 0, 1, false),
                await Import(Document([], [city])));
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(cityUrl + "/" + cityId)).StatusCode);
        }
        finally
        {
            // Production receipts remain append-only; only CI test fixtures
            // are cleaned from disposable CI PostgreSQL by unique content hash.
            await db.ImportReceipts.Where(x =>
                appliedDigests.Contains(x.ContentSha256))
                .ExecuteDeleteAsync();
            await db.Cities.Where(x =>
                x.Id == cityId || x.Id == draftCityId ||
                x.Id == otherCityId).ExecuteDeleteAsync();
            await db.Provinces.Where(x =>
                x.Id == provinceId ||
                x.Id == otherProvinceId).ExecuteDeleteAsync();
        }
    }

    private static object Province(Guid id, string name,
        string slug, string state) =>
        new { id, name, slug, state };

    private static object City(Guid id, Guid provinceId,
        string name, string slug, string state) =>
        new { id, provinceId, name, slug, state };

    private static string Document(object[] provinces, object[] cities) =>
        JsonSerializer.Serialize(new { provinces, cities });
}
