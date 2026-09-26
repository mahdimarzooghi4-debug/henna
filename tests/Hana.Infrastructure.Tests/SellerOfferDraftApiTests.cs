using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

[Collection("CatalogDatabase")]
public sealed class SellerOfferDraftApiTests
{
    [Fact]
    public async Task DraftCreationRequiresActiveSellerAndIsolatesIdempotentCatalogReferences()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var identityOptions =
            new DbContextOptionsBuilder<HanaIdentityDbContext>()
                .UseNpgsql(connection).Options;
        var sellerOptions =
            new DbContextOptionsBuilder<HanaSellerDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "seller"))
                .Options;
        var catalogOptions =
            new DbContextOptionsBuilder<HanaCatalogDbContext>()
                .UseNpgsql(connection, pg =>
                    pg.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "catalog"))
                .Options;

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        await using var catalog = new HanaCatalogDbContext(catalogOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());
        Assert.Empty(await catalog.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var ownerId = Guid.NewGuid();
        var secondSellerId = Guid.NewGuid();
        var unactivatedId = Guid.NewGuid();
        var regularAccountId = Guid.NewGuid();
        var ownerToken = SessionTokenCodec.Generate();
        var secondToken = SessionTokenCodec.Generate();
        var unactivatedToken = SessionTokenCodec.Generate();
        var regularToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(ownerToken, out var ownerDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(secondToken, out var secondDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(unactivatedToken, out var unactivatedDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(regularToken, out var regularDigest));

        identity.Accounts.AddRange(
            Account(ownerId, now), Account(secondSellerId, now),
            Account(unactivatedId, now), Account(regularAccountId, now));
        identity.AuthSessions.AddRange(
            Session(ownerId, ownerDigest, now),
            Session(secondSellerId, secondDigest, now),
            Session(unactivatedId, unactivatedDigest, now),
            Session(regularAccountId, regularDigest, now));
        identity.RoleAssignments.AddRange(
            SellerRole(ownerId, now), SellerRole(secondSellerId, now),
            SellerRole(unactivatedId, now));
        await identity.SaveChangesAsync();

        var businessCategory = Guid.NewGuid();
        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = businessCategory,
            Name = "پیش‌نویس کالا " + Guid.NewGuid().ToString("N")[..8],
            IsActive = true,
            UpdatedAtUtc = now
        });
        seller.RegistrationDrafts.AddRange(
            Application(ownerId, businessCategory, now, activated: true),
            Application(secondSellerId, businessCategory, now, activated: true),
            Application(unactivatedId, businessCategory, now, activated: false));
        await seller.SaveChangesAsync();

        var catalogCategoryId = Guid.NewGuid();
        catalog.Categories.Add(new CategoryRecord
        {
            Id = catalogCategoryId,
            Name = "دسته آزمون " + Guid.NewGuid().ToString("N")[..8],
            Slug = "seller-offer-" + Guid.NewGuid().ToString("N"),
            State = PublicationStates.Published,
            CreatedAtUtc = now
        });
        var goodId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        var unpublishedId = Guid.NewGuid();
        catalog.Products.AddRange(
            Product(goodId, catalogCategoryId,
                CatalogProductKinds.Good, PublicationStates.Published, now),
            Product(serviceId, catalogCategoryId,
                CatalogProductKinds.Service, PublicationStates.Published, now),
            Product(unpublishedId, catalogCategoryId,
                CatalogProductKinds.Good, PublicationStates.Draft, now));
        await catalog.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var owner = factory.CreateClient();
        using var second = factory.CreateClient();
        using var unactivated = factory.CreateClient();
        using var regular = factory.CreateClient();
        owner.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ownerToken);
        second.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", secondToken);
        unactivated.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", unactivatedToken);
        regular.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", regularToken);

        const string endpoint = "/api/v1/seller/offers";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(endpoint)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync(endpoint,
                new { catalogProductId = goodId })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await regular.GetAsync(endpoint)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await unactivated.GetAsync(endpoint)).StatusCode);

        using (var request = DraftRequest(
            endpoint, Guid.NewGuid(), goodId))
            Assert.Equal(HttpStatusCode.Forbidden,
                (await unactivated.SendAsync(request)).StatusCode);

        using (var serviceRequest = DraftRequest(
            endpoint, Guid.NewGuid(), serviceId))
            Assert.Equal(HttpStatusCode.Conflict,
                (await owner.SendAsync(serviceRequest)).StatusCode);
        using (var unpublishedRequest = DraftRequest(
            endpoint, Guid.NewGuid(), unpublishedId))
            Assert.Equal(HttpStatusCode.Conflict,
                (await owner.SendAsync(unpublishedRequest)).StatusCode);

        var key = Guid.NewGuid();
        using var create = DraftRequest(
            endpoint, key, goodId, includeUntrustedFields: true);
        using var created = await owner.SendAsync(create);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("no-store",
            created.Headers.CacheControl?.ToString());
        using var createdJson = JsonDocument.Parse(
            await created.Content.ReadAsStringAsync());
        var root = createdJson.RootElement;
        var offerId = root.GetProperty("id").GetGuid();
        Assert.Equal(goodId, root.GetProperty("catalogProductId").GetGuid());
        Assert.Equal("DRAFT", root.GetProperty("status").GetString());
        Assert.Equal(1, root.GetProperty("revision").GetInt32());
        Assert.False(root.TryGetProperty("sellerAccountId", out _));
        Assert.False(root.TryGetProperty("price", out _));
        Assert.False(root.TryGetProperty("quantity", out _));
        Assert.False(root.TryGetProperty("publicationStatus", out _));

        using var retry = DraftRequest(endpoint, key, goodId);
        using var retried = await owner.SendAsync(retry);
        Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
        using (var retriedJson = JsonDocument.Parse(
            await retried.Content.ReadAsStringAsync()))
            Assert.Equal(offerId,
                retriedJson.RootElement.GetProperty("id").GetGuid());

        using var reusedKey = DraftRequest(endpoint, key, serviceId);
        Assert.Equal(HttpStatusCode.Conflict,
            (await owner.SendAsync(reusedKey)).StatusCode);

        var ownerList = await owner.GetFromJsonAsync<JsonElement>(endpoint);
        var ownerItems = ownerList.GetProperty("items");
        Assert.Single(ownerItems.EnumerateArray());
        Assert.Equal(offerId,
            ownerItems[0].GetProperty("id").GetGuid());

        var secondList = await second.GetFromJsonAsync<JsonElement>(endpoint);
        Assert.Empty(secondList.GetProperty("items").EnumerateArray());

        var stored = await seller.OfferDrafts.AsNoTracking().ToListAsync();
        var only = Assert.Single(stored);
        Assert.Equal(ownerId, only.SellerAccountId);
        Assert.Equal(goodId, only.CatalogProductId);
        Assert.Equal(SellerOfferDraftStates.Draft, only.Status);
        Assert.Equal(key, only.IdempotencyKey);

        // Seller drafts do not become purchase offers in public Catalog.
        var publicPage = await anonymous.GetFromJsonAsync<JsonElement>(
            "/api/v1/catalog/products");
        var publicProduct = publicPage.GetProperty("items")
            .EnumerateArray()
            .Single(x => x.GetProperty("id").GetGuid() == goodId);
        Assert.False(publicProduct.TryGetProperty("offerId", out _));
        Assert.False(publicProduct.TryGetProperty("sellerAccountId", out _));
        Assert.False(publicProduct.TryGetProperty("price", out _));
        Assert.False(publicProduct.TryGetProperty("stock", out _));

        // This suite shares the CI PostgreSQL database with Catalog read tests.
        await seller.OfferDrafts.Where(x =>
            x.SellerAccountId == ownerId ||
            x.SellerAccountId == secondSellerId ||
            x.SellerAccountId == unactivatedId).ExecuteDeleteAsync();
        await seller.RegistrationDrafts.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == unactivatedId).ExecuteDeleteAsync();
        await seller.BusinessCategories
            .Where(x => x.Id == businessCategory).ExecuteDeleteAsync();
        await catalog.Products.Where(x =>
            x.Id == goodId || x.Id == serviceId ||
            x.Id == unpublishedId).ExecuteDeleteAsync();
        await catalog.Categories
            .Where(x => x.Id == catalogCategoryId).ExecuteDeleteAsync();
        await identity.AuthSessions.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == unactivatedId ||
            x.AccountId == regularAccountId).ExecuteDeleteAsync();
        await identity.RoleAssignments.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == unactivatedId).ExecuteDeleteAsync();
        await identity.Accounts.Where(x =>
            x.Id == ownerId ||
            x.Id == secondSellerId ||
            x.Id == unactivatedId ||
            x.Id == regularAccountId).ExecuteDeleteAsync();
    }

    private static HttpRequestMessage DraftRequest(
        string endpoint, Guid key, Guid catalogProductId,
        bool includeUntrustedFields = false)
    {
        var payload = includeUntrustedFields
            ? JsonContent.Create(new
            {
                catalogProductId,
                sellerAccountId = Guid.NewGuid(),
                productName = "Forged",
                imageUrl = "https://example.invalid/fake.png",
                kind = "SERVICE",
                price = 1,
                quantity = 1,
                unit = "fake",
                status = "ACTIVE"
            })
            : JsonContent.Create(new { catalogProductId });
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = payload
        };
        request.Headers.Add("Idempotency-Key", key.ToString());
        return request;
    }

    private static ProductRecord Product(
        Guid id, Guid categoryId, string kind, string state,
        DateTimeOffset now) => new()
    {
        Id = id,
        CategoryId = categoryId,
        Name = "کالای آزمون " + id.ToString("N")[..8],
        Kind = kind,
        State = state,
        Description = null,
        CreatedAtUtc = now
    };

    private static SellerRegistrationDraft Application(
        Guid accountId, Guid categoryId, DateTimeOffset now,
        bool activated)
    {
        var reviewerId = Guid.NewGuid();
        return new SellerRegistrationDraft
        {
            AccountId = accountId,
            StoreName = "فروشگاه آزمون",
            OwnerName = "مسئول آزمون",
            Phone = "09123456789",
            City = "تهران",
            Address = "نشانی آزمون",
            PostalCode = "1234567890",
            ApplicantType = "NATURAL",
            NaturalNationalCode = "0084575948",
            IdentityStatus = "VERIFIED",
            BusinessCategoryId = categoryId,
            BusinessName = "فروشگاه آزمون",
            BusinessDescription = "فروشگاه برای آزمون API.",
            BusinessPhone = "02112345678",
            OfferingType = "GOOD",
            ActivityProvinceId = Guid.NewGuid(),
            ActivityCityId = Guid.NewGuid(),
            ActivityAddress = "نشانی فعالیت",
            ActivityHours = "۸ تا ۲۲",
            SellerDelivery = true,
            Pickup = true,
            ServiceArea = "تهران",
            RegistrationContactName = "مسئول ثبت",
            ResponseHours = "۸ تا ۲۲",
            CompletedStep = 6,
            Status = "SUBMITTED",
            Revision = 6,
            SubmissionKey = Guid.NewGuid(),
            SubmissionExpectedRevision = 5,
            SubmittedAtUtc = now.AddMinutes(-20),
            AccuracyConfirmedAtUtc = now.AddMinutes(-20),
            TrackingCode = "HNA-" + Guid.NewGuid().ToString("N")[..16],
            ReviewStatus = "APPROVED",
            ReviewedByAccountId = reviewerId,
            ReviewedAtUtc = now.AddMinutes(-10),
            ActivatedAtUtc = activated ? now.AddMinutes(-5) : null,
            ActivatedByAccountId = activated ? reviewerId : null,
            UpdatedAtUtc = now.AddMinutes(-5)
        };
    }

    private static AccountRecord Account(Guid id, DateTimeOffset now) => new()
    {
        Id = id,
        NormalizedPhone = NewPhone(),
        CreatedAtUtc = now,
        PhoneVerifiedAtUtc = now
    };

    private static AuthSessionRecord Session(
        Guid accountId, byte[] digest, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        TokenDigest = digest,
        IssuedAtUtc = now.AddMinutes(-1),
        ExpiresAtUtc = now.AddHours(1)
    };

    private static RoleAssignmentRecord SellerRole(
        Guid accountId, DateTimeOffset now) => new()
    {
        AccountId = accountId,
        Role = HanaRoles.Seller,
        GrantedAtUtc = now.AddMinutes(-5)
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
