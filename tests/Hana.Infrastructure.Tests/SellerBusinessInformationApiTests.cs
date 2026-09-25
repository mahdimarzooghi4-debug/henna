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

public sealed class SellerBusinessInformationApiTests
{
    [Fact]
    public async Task StepFourRequiresActiveReviewedCategoryAndExactRevision()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var phone = NewPhone();
        var token = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(token, out var hash));

        identity.Accounts.Add(new AccountRecord
        {
            Id = accountId, NormalizedPhone = phone,
            CreatedAtUtc = now, PhoneVerifiedAtUtc = now
        });
        identity.AuthSessions.Add(new AuthSessionRecord
        {
            Id = Guid.NewGuid(), AccountId = accountId, TokenDigest = hash,
            IssuedAtUtc = now.AddMinutes(-1), ExpiresAtUtc = now.AddHours(1)
        });
        await identity.SaveChangesAsync();

        var active = Guid.NewGuid();
        var inactive = Guid.NewGuid();
        seller.BusinessCategories.AddRange(
            new SellerBusinessCategoryRecord
            {
                Id = active, Name = "دسته‌بندی فعال آزمون",
                IsActive = true, UpdatedAtUtc = now
            },
            new SellerBusinessCategoryRecord
            {
                Id = inactive, Name = "دسته‌بندی غیرفعال آزمون",
                IsActive = false, UpdatedAtUtc = now
            });
        seller.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = accountId, StoreName = "نام اولیه",
            OwnerName = "مسئول آزمون", Phone = phone, City = "تهران",
            Address = "نشانی آزمون", PostalCode = "1234567890",
            ApplicantType = "NATURAL",
            NaturalNationalCode = "0084575948",
            IdentityStatus = "VERIFIED",
            CompletedStep = 3, Status = "DRAFT", Revision = 1,
            UpdatedAtUtc = now
        });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var categories = await client.GetAsync(
            "/api/v1/seller/registration/business-categories");
        Assert.Equal(HttpStatusCode.OK, categories.StatusCode);
        using (var body = JsonDocument.Parse(
            await categories.Content.ReadAsStringAsync()))
        {
            Assert.True(body.RootElement.GetProperty("configured").GetBoolean());
            var items = body.RootElement.GetProperty("items")
                .EnumerateArray().ToArray();
            Assert.Contains(items, x => x.GetProperty("id").GetGuid() == active);
            Assert.DoesNotContain(items,
                x => x.GetProperty("id").GetGuid() == inactive);
        }

        const string url =
            "/api/v1/seller/registration/business-information";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync(url, new
            {
                categoryId = inactive, businessName = "کسب‌وکار",
                description = "توضیح فعالیت", businessPhone = "02112345678",
                offeringType = "GOOD", revision = 1
            })).StatusCode);

        var saved = await client.PutAsJsonAsync(url, new
        {
            categoryId = active,
            businessName = "کسب‌وکار آزمون",
            description = "ارائه کالا و خدمات محلی",
            businessPhone = "۰۲۱۱۲۳۴۵۶۷۸",
            offeringType = "BOTH",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        using (var body = JsonDocument.Parse(
            await saved.Content.ReadAsStringAsync()))
        {
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal(4,
                body.RootElement.GetProperty("completedStep").GetInt32());
            Assert.Equal("02112345678",
                body.RootElement.GetProperty("businessPhone").GetString());
            Assert.Equal("BOTH",
                body.RootElement.GetProperty("offeringType").GetString());
        }

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync(url, new
            {
                categoryId = active, businessName = "نسخه قدیمی",
                description = "نباید ذخیره شود", businessPhone = "02112345678",
                offeringType = "GOOD", revision = 1
            })).StatusCode);

        var row = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == accountId);
        Assert.Equal(4, row.CompletedStep);
        Assert.Equal(active, row.BusinessCategoryId);
        Assert.Equal("BOTH", row.OfferingType);

        var restored = await client.GetAsync("/api/v1/seller/registration");
        using var restoredBody = JsonDocument.Parse(
            await restored.Content.ReadAsStringAsync());
        Assert.Equal("دسته‌بندی فعال آزمون",
            restoredBody.RootElement
                .GetProperty("businessCategoryName").GetString());
    }

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
