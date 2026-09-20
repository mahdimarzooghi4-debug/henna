using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hana.Infrastructure.Geography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// Real ASP.NET and disposable CI PostgreSQL. No city or launch data is
/// seeded into shipping builds or production by migrations.
/// </summary>
public sealed class GeographyReadApiTests
{
    [Fact]
    public async Task OnlySelectableCitiesInSelectableProvincesCanBeRead()
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

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        const string provinceUrl = "/api/v1/geography/provinces";
        const string cityUrl = "/api/v1/geography/cities";

        var initiallyVisible = await client.GetAsync(provinceUrl);
        Assert.Equal(HttpStatusCode.OK, initiallyVisible.StatusCode);
        Assert.Equal("no-store",
            initiallyVisible.Headers.GetValues("Cache-Control").Single());
        using (var initial = JsonDocument.Parse(
            await initiallyVisible.Content.ReadAsStringAsync()))
            Assert.Equal(0, initial.RootElement.GetProperty("items")
                .GetArrayLength());

        var activeProvince = Guid.NewGuid();
        var hiddenProvince = Guid.NewGuid();
        var secondProvince = Guid.NewGuid();
        var activeCity = Guid.NewGuid();
        var draftCity = Guid.NewGuid();
        var hiddenByProvinceCity = Guid.NewGuid();
        var sameSlugOtherProvinceCity = Guid.NewGuid();
        db.Provinces.AddRange(
            Province(activeProvince, "ci-selectable-", "استان انتخابی",
                GeographyStates.Selectable),
            Province(hiddenProvince, "ci-draft-", "استان پیش‌نویس",
                GeographyStates.Draft),
            Province(secondProvince, "ci-other-", "استان دوم",
                GeographyStates.Selectable));
        db.Cities.AddRange(
            City(activeCity, activeProvince, "شهر انتخابی", "shared-city",
                GeographyStates.Selectable),
            City(draftCity, activeProvince, "شهر پیش‌نویس", "unlisted-city",
                GeographyStates.Draft),
            City(hiddenByProvinceCity, hiddenProvince,
                "شهر استان پیش‌نویس", "hidden-city",
                GeographyStates.Selectable),
            City(sameSlugOtherProvinceCity, secondProvince,
                "شهر همنام استان دیگر", "shared-city",
                GeographyStates.Selectable));
        await db.SaveChangesAsync();

        try
        {
            var provinces = await client.GetFromJsonAsync<JsonElement>(provinceUrl);
            var listedProvinces = provinces.GetProperty("items")
                .EnumerateArray().ToArray();
            Assert.Contains(listedProvinces, x =>
                x.GetProperty("id").GetGuid() == activeProvince);
            Assert.Contains(listedProvinces, x =>
                x.GetProperty("id").GetGuid() == secondProvince);
            Assert.DoesNotContain(listedProvinces, x =>
                x.GetProperty("id").GetGuid() == hiddenProvince);
            Assert.All(listedProvinces, item =>
            {
                Assert.False(item.TryGetProperty("state", out _));
                Assert.False(item.TryGetProperty("hasSellers", out _));
            });

            var cities = await client.GetAsync(
                cityUrl + "?provinceId=" + activeProvince);
            Assert.Equal(HttpStatusCode.OK, cities.StatusCode);
            Assert.Equal("no-store",
                cities.Headers.GetValues("Cache-Control").Single());
            using (var listing = JsonDocument.Parse(
                await cities.Content.ReadAsStringAsync()))
            {
                var items = listing.RootElement.GetProperty("items")
                    .EnumerateArray().ToArray();
                Assert.Single(items);
                Assert.Equal(activeCity, items[0].GetProperty("id").GetGuid());
                Assert.Equal(activeProvince, items[0]
                    .GetProperty("provinceId").GetGuid());
                Assert.Equal("شهر انتخابی", items[0]
                    .GetProperty("name").GetString());
                Assert.False(items[0].TryGetProperty("state", out _));
                Assert.False(items[0].TryGetProperty("deliveryAvailable", out _));
            }

            var hiddenCities = await client.GetFromJsonAsync<JsonElement>(
                cityUrl + "?provinceId=" + hiddenProvince);
            Assert.Equal(0, hiddenCities.GetProperty("items").GetArrayLength());
            var otherProvinceCities = await client.GetFromJsonAsync<JsonElement>(
                cityUrl + "?provinceId=" + secondProvince);
            Assert.Equal(sameSlugOtherProvinceCity,
                otherProvinceCities.GetProperty("items")[0]
                    .GetProperty("id").GetGuid());

            var detail = await client.GetFromJsonAsync<JsonElement>(
                cityUrl + "/" + activeCity);
            Assert.Equal(activeCity, detail.GetProperty("id").GetGuid());
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + draftCity)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" +
                    hiddenByProvinceCity)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + Guid.NewGuid())).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + Guid.Empty)).StatusCode);

            foreach (var invalid in new[]
            {
                cityUrl,
                cityUrl + "?provinceId=bad",
                cityUrl + "?provinceId=" + Guid.Empty,
                cityUrl + "?provinceId=" + activeProvince +
                    "&provinceId=" + hiddenProvince,
                cityUrl + "?provinceId=" + activeProvince + "&extra=value"
            })
                Assert.Equal(HttpStatusCode.BadRequest,
                    (await client.GetAsync(invalid)).StatusCode);

            // Withdrawal of a parent is effective immediately; city records
            // stay intact and can become selectable again explicitly.
            await db.Provinces.Where(p => p.Id == activeProvince)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.State, GeographyStates.Draft));
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync(cityUrl + "/" + activeCity)).StatusCode);
            var afterWithdrawal = await client.GetFromJsonAsync<JsonElement>(
                cityUrl + "?provinceId=" + activeProvince);
            Assert.Equal(0, afterWithdrawal.GetProperty("items").GetArrayLength());

            await db.Provinces.Where(p => p.Id == activeProvince)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.State, GeographyStates.Selectable));
            Assert.Equal(HttpStatusCode.OK,
                (await client.GetAsync(cityUrl + "/" + activeCity)).StatusCode);
        }
        finally
        {
            await db.Cities.Where(c => c.Id == activeCity || c.Id == draftCity ||
                c.Id == hiddenByProvinceCity ||
                c.Id == sameSlugOtherProvinceCity).ExecuteDeleteAsync();
            await db.Provinces.Where(p => p.Id == activeProvince ||
                p.Id == hiddenProvince || p.Id == secondProvince)
                .ExecuteDeleteAsync();
        }
    }

    private static ProvinceRecord Province(
        Guid id, string slugPrefix, string name, string state) => new()
    {
        Id = id, Name = name, Slug = slugPrefix + id.ToString("N"),
        State = state
    };

    private static CityRecord City(
        Guid id, Guid provinceId, string name, string slug, string state) => new()
    {
        Id = id, ProvinceId = provinceId, Name = name,
        Slug = slug, State = state
    };
}
