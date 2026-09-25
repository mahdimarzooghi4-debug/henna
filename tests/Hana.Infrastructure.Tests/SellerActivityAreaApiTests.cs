using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Geography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class SellerActivityAreaApiTests
{
    [Fact]
    public async Task StepFiveRequiresSelectableMatchingProvinceAndCity()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        var geographyOptions =
            new DbContextOptionsBuilder<HanaGeographyDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "geography"))
                .Options;

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        await using var geography =
            new HanaGeographyDbContext(geographyOptions);

        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());
        Assert.Empty(await geography.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var provinceId = Guid.NewGuid();
        var cityId = Guid.NewGuid();
        var otherProvinceId = Guid.NewGuid();
        var suffix = Guid.NewGuid().ToString("N");
        var phone = "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
        var token = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(token, out var digest));

        identity.Accounts.Add(new AccountRecord
        {
            Id = accountId,
            NormalizedPhone = phone,
            CreatedAtUtc = now,
            PhoneVerifiedAtUtc = now
        });
        identity.AuthSessions.Add(new AuthSessionRecord
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            TokenDigest = digest,
            IssuedAtUtc = now.AddMinutes(-1),
            ExpiresAtUtc = now.AddHours(1)
        });
        await identity.SaveChangesAsync();

        geography.Provinces.AddRange(
            new ProvinceRecord
            {
                Id = provinceId,
                Name = "استان فعالیت CI",
                Slug = "seller-activity-" + suffix,
                State = GeographyStates.Selectable
            },
            new ProvinceRecord
            {
                Id = otherProvinceId,
                Name = "استان دیگر CI",
                Slug = "seller-activity-other-" + suffix,
                State = GeographyStates.Selectable
            });
        geography.Cities.Add(new CityRecord
        {
            Id = cityId,
            ProvinceId = provinceId,
            Name = "شهر فعالیت CI",
            Slug = "seller-activity-city-" + suffix,
            State = GeographyStates.Selectable
        });
        await geography.SaveChangesAsync();

        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = categoryId,
            Name = "دسته‌بندی فعالیت CI",
            IsActive = true,
            UpdatedAtUtc = now
        });
        seller.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = accountId,
            StoreName = "فروشگاه فعالیت",
            OwnerName = "مسئول فعالیت",
            Phone = phone,
            City = "شهر اولیه",
            Address = "نشانی اولیه",
            PostalCode = "1234567890",
            ApplicantType = "NATURAL",
            NaturalNationalCode = "0084575948",
            IdentityStatus = "VERIFIED",
            BusinessCategoryId = categoryId,
            BusinessName = "کسب‌وکار فعالیت",
            BusinessDescription = "توضیح فعالیت کسب‌وکار",
            BusinessPhone = "02112345678",
            OfferingType = "BOTH",
            CompletedStep = 4,
            Status = "DRAFT",
            Revision = 1,
            UpdatedAtUtc = now
        });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        const string url = "/api/v1/seller/registration/activity-area";

        var mismatch = await client.PutAsJsonAsync(url, new
        {
            provinceId = otherProvinceId,
            cityId,
            address = "خیابان آزمون، پلاک ۱۲",
            activityHours = "شنبه تا پنجشنبه، ۸ تا ۲۲",
            sellerDelivery = true,
            pickup = false,
            serviceArea = "کل شهر",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.BadRequest, mismatch.StatusCode);

        var noDelivery = await client.PutAsJsonAsync(url, new
        {
            provinceId,
            cityId,
            address = "خیابان آزمون، پلاک ۱۲",
            activityHours = "شنبه تا پنجشنبه، ۸ تا ۲۲",
            sellerDelivery = false,
            pickup = false,
            serviceArea = "کل شهر",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.BadRequest, noDelivery.StatusCode);

        var saved = await client.PutAsJsonAsync(url, new
        {
            provinceId,
            cityId,
            address = "خیابان آزمون، پلاک ۱۲",
            activityHours = "شنبه تا پنجشنبه، ۸ تا ۲۲",
            sellerDelivery = true,
            pickup = true,
            serviceArea = "کل شهر و محدوده اطراف",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        using (var body = JsonDocument.Parse(
            await saved.Content.ReadAsStringAsync()))
        {
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal(5,
                body.RootElement.GetProperty("completedStep").GetInt32());
            Assert.Equal("استان فعالیت CI",
                body.RootElement.GetProperty("province")
                    .GetProperty("name").GetString());
            Assert.Equal("شهر فعالیت CI",
                body.RootElement.GetProperty("city")
                    .GetProperty("name").GetString());
        }

        var row = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == accountId);
        Assert.Equal(5, row.CompletedStep);
        Assert.Equal(provinceId, row.ActivityProvinceId);
        Assert.Equal(cityId, row.ActivityCityId);
        Assert.True(row.SellerDelivery);
        Assert.True(row.Pickup);

        var restored = await client.GetAsync("/api/v1/seller/registration");
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
        using var restoredBody = JsonDocument.Parse(
            await restored.Content.ReadAsStringAsync());
        Assert.Equal("استان فعالیت CI",
            restoredBody.RootElement
                .GetProperty("activityProvinceName").GetString());
        Assert.Equal("شهر فعالیت CI",
            restoredBody.RootElement
                .GetProperty("activityCityName").GetString());
    }
}
