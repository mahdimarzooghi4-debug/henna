using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Buyer;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

[Collection("CatalogDatabase")]
public sealed class BuyerPurchaseDraftApiTests
{
    [Fact]
    public async Task DraftIsAccountScopedIdempotentAndRequiresCurrentPriceConfirmation()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options;
        var buyerOptions = new DbContextOptionsBuilder<HanaBuyerDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "buyer")).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller")).Options;
        var catalogOptions = new DbContextOptionsBuilder<HanaCatalogDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "catalog")).Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var buyer = new HanaBuyerDbContext(buyerOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        await using var catalog = new HanaCatalogDbContext(catalogOptions);
        Assert.Empty(await buyer.Database.GetPendingMigrationsAsync());
        var now = DateTimeOffset.UtcNow;
        var buyerId = Guid.NewGuid(); var sellerId = Guid.NewGuid();
        var buyerToken = SessionTokenCodec.Generate(); var otherToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(buyerToken, out var digest));
        Assert.True(SessionTokenCodec.TryComputeDigest(otherToken, out var otherDigest));
        identity.Accounts.AddRange(Account(buyerId, now), Account(Guid.NewGuid(), now));
        var otherAccount = identity.Accounts.Local.Last().Id;
        identity.AuthSessions.AddRange(Session(buyerId, digest, now), Session(otherAccount, otherDigest, now));
        identity.Accounts.Add(Account(sellerId, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord { AccountId = sellerId, Role = HanaRoles.Seller, GrantedAtUtc = now });
        await identity.SaveChangesAsync();

        var sellerCategoryId = Guid.NewGuid();
        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord { Id = sellerCategoryId, Name = "دسته خرید " + Guid.NewGuid().ToString("N"), IsActive = true, UpdatedAtUtc = now });
        var publicSellerId = Guid.NewGuid();
        seller.RegistrationDrafts.Add(ApprovedSeller(sellerId, publicSellerId, sellerCategoryId, now));
        await seller.SaveChangesAsync();

        var catalogCategoryId = Guid.NewGuid(); var productId = Guid.NewGuid(); var offerId = Guid.NewGuid();
        catalog.Categories.Add(new CategoryRecord { Id = catalogCategoryId, Name = "دسته کالای خرید", Slug = "buyer-purchase-" + Guid.NewGuid().ToString("N"), State = PublicationStates.Published, CreatedAtUtc = now });
        catalog.Products.Add(new ProductRecord { Id = productId, CategoryId = catalogCategoryId, Name = "کالای آزمون", Kind = CatalogProductKinds.Good, State = PublicationStates.Published, UnitName = "کیلوگرم", QuantityScale = 1, CreatedAtUtc = now });
        await catalog.SaveChangesAsync();
        seller.OfferDrafts.Add(new SellerOfferDraftRecord { Id = offerId, SellerAccountId = sellerId, CatalogProductId = productId, Status = SellerOfferDraftStates.Published, Revision = 2, IdempotencyKey = Guid.NewGuid(), PriceRials = 100_000, SellableQuantity = 3m, CreatedAtUtc = now, UpdatedAtUtc = now });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        using var other = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);
        const string endpoint = "/api/v1/buyer/cart/purchase-draft";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(endpoint)).StatusCode);
        Assert.Equal("no-store", (await client.GetAsync(endpoint)).Headers.CacheControl?.ToString());
        Assert.Equal(0, (await other.GetFromJsonAsync<JsonElement>(endpoint)).GetProperty("revision").GetInt64());
        var cartSet = await client.PutAsJsonAsync($"/api/v1/buyer/cart/items/{productId}", new { revision = 0, quantity = 2.5m });
        Assert.Equal(HttpStatusCode.OK, cartSet.StatusCode);

        var key = Guid.NewGuid();
        using var save = Save(client, endpoint, key, 0, 1, publicSellerId, productId, offerId, 100_000);
        using var created = await client.SendAsync(save);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        Assert.Equal(1, createdJson.RootElement.GetProperty("revision").GetInt64());
        Assert.Equal(1, createdJson.RootElement.GetProperty("lines").GetArrayLength());
        Assert.Equal(2.5m, createdJson.RootElement.GetProperty("lines")[0].GetProperty("quantity").GetDecimal());

        using var retry = Save(client, endpoint, key, 0, 1, publicSellerId, productId, offerId, 100_000);
        using var replay = await client.SendAsync(retry);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(1, (await replay.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("revision").GetInt64());
        using var reused = Save(client, endpoint, key, 1, 1, publicSellerId, productId, offerId, 100_000);
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(reused)).StatusCode);

        var offer = await seller.OfferDrafts.SingleAsync(x => x.Id == offerId);
        offer.PriceRials = 125_000; offer.UpdatedAtUtc = now.AddMinutes(1);
        await seller.SaveChangesAsync();
        using (var current = await client.GetAsync(endpoint))
        {
            using var json = JsonDocument.Parse(await current.Content.ReadAsStringAsync());
            Assert.True(json.RootElement.GetProperty("lines")[0].GetProperty("priceChanged").GetBoolean());
            Assert.Equal(125_000, json.RootElement.GetProperty("lines")[0].GetProperty("currentPriceRials").GetInt64());
        }
        using var stalePrice = Save(client, endpoint, Guid.NewGuid(), 1, 1, publicSellerId, productId, offerId, 100_000);
        using var conflict = await client.SendAsync(stalePrice);
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        Assert.Equal("PRICE_CHANGED", (await conflict.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        using var unconfirmedPrice = Save(client, endpoint, Guid.NewGuid(), 1, 1, publicSellerId, productId, offerId, 125_000);
        using var confirmationRequired = await client.SendAsync(unconfirmedPrice);
        Assert.Equal(HttpStatusCode.Conflict, confirmationRequired.StatusCode);
        Assert.Equal("PRICE_CONFIRMATION_REQUIRED", (await confirmationRequired.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        using var confirmedPrice = Save(client, endpoint, Guid.NewGuid(), 1, 1, publicSellerId, productId, offerId, 125_000, true);
        using var updated = await client.SendAsync(confirmedPrice);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(2, (await updated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("revision").GetInt64());

        var deleteKey = Guid.NewGuid();
        using var delete = new HttpRequestMessage(HttpMethod.Delete, endpoint) { Content = JsonContent.Create(new { revision = 2 }) };
        delete.Headers.Add("Idempotency-Key", deleteKey.ToString());
        using var deleted = await client.SendAsync(delete);
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        var deletedJson = await deleted.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, deletedJson.GetProperty("revision").GetInt64());
        Assert.Null(deletedJson.GetProperty("sellerPublicId").GetString());
        Assert.Equal(1, (await client.GetFromJsonAsync<JsonElement>("/api/v1/buyer/cart")).GetProperty("items").GetArrayLength());
    }

    private static HttpRequestMessage Save(HttpClient client, string endpoint,
        Guid key, long revision, long cartRevision, Guid sellerPublicId,
        Guid productId, Guid offerId, long price, bool confirmCurrentPriceChanges = false)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, endpoint)
        {
            Content = JsonContent.Create(new { revision, cartRevision, sellerPublicId, confirmCurrentPriceChanges,
                lines = new[] { new { productId, offerId, expectedPriceRials = price } } })
        };
        request.Headers.Add("Idempotency-Key", key.ToString());
        return request;
    }

    private static SellerRegistrationDraft ApprovedSeller(Guid accountId,
        Guid publicSellerId, Guid categoryId, DateTimeOffset now)
    {
        var reviewer = Guid.NewGuid();
        return new SellerRegistrationDraft { AccountId = accountId, PublicSellerId = publicSellerId,
            StoreName = "فروشگاه آزمون", OwnerName = "مالک آزمون", Phone = "09123456789", City = "تهران", Address = "نشانی آزمون", PostalCode = "1234567890",
            ApplicantType = "NATURAL", NaturalNationalCode = "0084575948", IdentityStatus = "VERIFIED", BusinessCategoryId = categoryId,
            BusinessName = "کسب‌وکار آزمون", BusinessDescription = "توضیح آزمون معتبر", BusinessPhone = "02112345678", OfferingType = "GOOD",
            ActivityProvinceId = Guid.NewGuid(), ActivityCityId = Guid.NewGuid(), ActivityAddress = "نشانی", ActivityHours = "۸ تا ۲۲", SellerDelivery = true, Pickup = true, ServiceArea = "تهران",
            RegistrationContactName = "مسئول", ResponseHours = "۸ تا ۲۲", CompletedStep = 6, Status = "SUBMITTED", Revision = 6,
            SubmissionKey = Guid.NewGuid(), SubmissionExpectedRevision = 5, SubmittedAtUtc = now, AccuracyConfirmedAtUtc = now,
            TrackingCode = "HNA-" + Guid.NewGuid().ToString("N")[..16], ReviewStatus = "APPROVED", ReviewedByAccountId = reviewer,
            ReviewedAtUtc = now, ActivatedAtUtc = now, ActivatedByAccountId = reviewer, UpdatedAtUtc = now };
    }

    private static AccountRecord Account(Guid id, DateTimeOffset now) => new() { Id = id, NormalizedPhone = NewPhone(), CreatedAtUtc = now, PhoneVerifiedAtUtc = now };
    private static AuthSessionRecord Session(Guid accountId, byte[] digest, DateTimeOffset now) => new() { Id = Guid.NewGuid(), AccountId = accountId, TokenDigest = digest, IssuedAtUtc = now.AddMinutes(-1), ExpiresAtUtc = now.AddHours(1) };
    private static string NewPhone() => "09" + RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9", CultureInfo.InvariantCulture);
}
