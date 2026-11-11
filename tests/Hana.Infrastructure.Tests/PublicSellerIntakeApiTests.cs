using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

/// <summary>
/// Real PostgreSQL, no buyer account, no OTP shortcuts or Seller roles.
/// </summary>
public sealed class PublicSellerIntakeApiTests
{
    [Fact]
    public async Task UnauthenticatedApplicationIsReceiptScopedIdempotentAndNeverActivatesSeller()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var options = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var db = new HanaSellerDbContext(options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var otherToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var uniqueStoreName = "فروشگاه تست عمومی " + Guid.NewGuid().ToString("N");
        var payload = new {
            storeName = uniqueStoreName,
            ownerName = "مسئول درخواست",
            phone = "09123456789",
            city = "شهر تست",
            address = "نشانی تست",
            postalCode = "1234567890",
            applicantType = "NATURAL",
            businessName = "کسب‌وکار تست",
            businessDescription = "فروش محصولات تست",
            offeringType = "GOOD",
            activityAddress = "نشانی فعالیت تست",
            activityHours = "۹ تا ۱۷",
            sellerDelivery = true,
            pickup = false,
            serviceArea = "محدوده تست",
            registrationContactName = "مسئول درخواست",
            registrationContactRole = (string?)null,
            backupPhone = (string?)null,
            websiteOrSocial = (string?)null,
            businessEmail = (string?)null,
            responseHours = "۹ تا ۱۷",
            confirmed = true,
        };

        async Task<HttpResponseMessage> PostAsync(string? secret, object body)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post,
                "/api/v1/seller/public-registration");
            if (secret is not null)
                request.Headers.Add("X-Hana-Seller-Intake-Token", secret);
            request.Content = JsonContent.Create(body);
            return await client.SendAsync(request);
        }
        async Task<HttpResponseMessage> GetAsync(string? secret)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,
                "/api/v1/seller/public-registration/status");
            if(secret is not null)
                request.Headers.Add("X-Hana-Seller-Intake-Token", secret);
            return await client.SendAsync(request);
        }
        Assert.False(await db.RegistrationDrafts.AsNoTracking()
            .AnyAsync(x => x.StoreName == uniqueStoreName));

        using var withoutSecret = await PostAsync(null, payload);
        Assert.Equal(HttpStatusCode.BadRequest, withoutSecret.StatusCode);
        using var created = await PostAsync(token, payload);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var tracking = createdJson.RootElement.GetProperty("trackingCode").GetString();
        Assert.Matches("^HNA-P-[0-9A-F]{16}$", tracking!);
        Assert.Equal("RECEIVED", createdJson.RootElement.GetProperty("status").GetString());

        using var retry = await PostAsync(token, payload);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        using var retryJson = JsonDocument.Parse(await retry.Content.ReadAsStringAsync());
        Assert.Equal(tracking, retryJson.RootElement.GetProperty("trackingCode").GetString());

        using var changed = await PostAsync(token, new {
            payload.storeName,payload.ownerName,payload.phone,payload.city,
            payload.address,payload.postalCode,payload.applicantType,
            payload.businessName,payload.businessDescription,payload.offeringType,
            payload.activityAddress,payload.activityHours,payload.sellerDelivery,
            payload.pickup,serviceArea="another",payload.registrationContactName,
            payload.registrationContactRole,payload.backupPhone,
            payload.websiteOrSocial,payload.businessEmail,payload.responseHours,
            confirmed=true
        });
        Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
        using var anonymousGet = await GetAsync(null);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousGet.StatusCode);
        using var otherGet = await GetAsync(otherToken);
        Assert.Equal(HttpStatusCode.NotFound, otherGet.StatusCode);
        using var mine = await GetAsync(token);
        Assert.Equal(HttpStatusCode.OK,mine.StatusCode);
        using var status = JsonDocument.Parse(await mine.Content.ReadAsStringAsync());
        Assert.Equal(tracking,status.RootElement.GetProperty("trackingCode").GetString());
        Assert.Equal("RECEIVED",status.RootElement.GetProperty("status").GetString());

        // Other integration tests run concurrently against the CI database:
        // assert isolation by this application's exact unique identity, not
        // by a fragile global count of unrelated drafts.
        Assert.False(await db.RegistrationDrafts.AsNoTracking()
            .AnyAsync(x => x.StoreName == uniqueStoreName));

        var digest=Convert.ToHexString(SHA256.HashData(Convert.FromHexString(token)));
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM seller.public_registration_intakes WHERE credential_digest = {digest}");
    }
}
