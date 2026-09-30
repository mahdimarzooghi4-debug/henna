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

public sealed class SellerAdditionalInformationApiTests
{
    [Fact]
    public async Task StepSixValidatesAndPersistsAdditionalInformation()
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

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
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

        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = categoryId,
            Name = "دسته‌بندی تکمیلی " + Guid.NewGuid().ToString("N")[..8],
            IsActive = true,
            UpdatedAtUtc = now
        });
        seller.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = accountId,
            StoreName = "فروشگاه تکمیلی",
            OwnerName = "مسئول تکمیلی",
            Phone = phone,
            City = "شهر اولیه",
            Address = "نشانی اولیه",
            PostalCode = "1234567890",
            ApplicantType = "NATURAL",
            NaturalNationalCode = "0084575948",
            IdentityStatus = "VERIFIED",
            BusinessCategoryId = categoryId,
            BusinessName = "کسب‌وکار تکمیلی",
            BusinessDescription = "توضیح کسب‌وکار تکمیلی",
            BusinessPhone = "02112345678",
            OfferingType = "BOTH",
            ActivityProvinceId = Guid.NewGuid(),
            ActivityCityId = Guid.NewGuid(),
            ActivityAddress = "نشانی فعالیت",
            ActivityHours = "شنبه تا پنجشنبه، ۸ تا ۲۲",
            SellerDelivery = true,
            Pickup = true,
            ServiceArea = "کل شهر",
            CompletedStep = 5,
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

        const string url =
            "/api/v1/seller/registration/additional-information";

        var badPhone = await client.PutAsJsonAsync(url, new
        {
            contactName = "مسئول تکمیلی",
            contactRole = "مدیر فروش",
            backupPhone = "0912",
            websiteOrSocial = "instagram.com/hana-ci",
            businessEmail = "info@example.com",
            responseHours = "۸ تا ۲۲",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.BadRequest, badPhone.StatusCode);

        var badEmail = await client.PutAsJsonAsync(url, new
        {
            contactName = "مسئول تکمیلی",
            contactRole = (string?)null,
            backupPhone = (string?)null,
            websiteOrSocial = (string?)null,
            businessEmail = "not-an-email",
            responseHours = "۸ تا ۲۲",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.BadRequest, badEmail.StatusCode);

        var saved = await client.PutAsJsonAsync(url, new
        {
            contactName = "مسئول تکمیلی",
            contactRole = "مدیر فروش",
            backupPhone = "09123456780",
            websiteOrSocial = "instagram.com/hana-ci",
            businessEmail = "info@example.com",
            responseHours = "شنبه تا پنجشنبه، ۸ تا ۲۲",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        using (var body = JsonDocument.Parse(
            await saved.Content.ReadAsStringAsync()))
        {
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal(6,
                body.RootElement.GetProperty("completedStep").GetInt32());
            Assert.False(
                body.RootElement.GetProperty("documentsRequired").GetBoolean());
        }

        var row = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == accountId);
        Assert.Equal(6, row.CompletedStep);
        Assert.Equal("مسئول تکمیلی", row.RegistrationContactName);
        Assert.Equal("مدیر فروش", row.RegistrationContactRole);
        Assert.Equal("09123456780", row.BackupPhone);
        Assert.Equal("instagram.com/hana-ci", row.WebsiteOrSocial);
        Assert.Equal("info@example.com", row.BusinessEmail);
        Assert.Equal("شنبه تا پنجشنبه، ۸ تا ۲۲", row.ResponseHours);

        var stale = await client.PutAsJsonAsync(url, new
        {
            contactName = "نسخه قدیمی",
            contactRole = (string?)null,
            backupPhone = (string?)null,
            websiteOrSocial = (string?)null,
            businessEmail = (string?)null,
            responseHours = "۸ تا ۲۲",
            revision = 1
        });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var restored = await client.GetAsync("/api/v1/seller/registration");
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
        using var restoredBody = JsonDocument.Parse(
            await restored.Content.ReadAsStringAsync());
        Assert.Equal("مسئول تکمیلی",
            restoredBody.RootElement
                .GetProperty("registrationContactName").GetString());
        Assert.Equal("شنبه تا پنجشنبه، ۸ تا ۲۲",
            restoredBody.RootElement.GetProperty("responseHours").GetString());
        Assert.False(restoredBody.RootElement
            .GetProperty("documentsRequired").GetBoolean());
    }
}
