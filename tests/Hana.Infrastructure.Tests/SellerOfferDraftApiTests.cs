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
        var serviceOnlySellerId = Guid.NewGuid();
        var unactivatedId = Guid.NewGuid();
        var regularAccountId = Guid.NewGuid();
        var ownerToken = SessionTokenCodec.Generate();
        var secondToken = SessionTokenCodec.Generate();
        var serviceOnlyToken = SessionTokenCodec.Generate();
        var unactivatedToken = SessionTokenCodec.Generate();
        var regularToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(ownerToken, out var ownerDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(secondToken, out var secondDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(serviceOnlyToken, out var serviceOnlyDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(unactivatedToken, out var unactivatedDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(regularToken, out var regularDigest));

        identity.Accounts.AddRange(
            Account(ownerId, now), Account(secondSellerId, now),
            Account(serviceOnlySellerId, now),
            Account(unactivatedId, now), Account(regularAccountId, now));
        identity.AuthSessions.AddRange(
            Session(ownerId, ownerDigest, now),
            Session(secondSellerId, secondDigest, now),
            Session(serviceOnlySellerId, serviceOnlyDigest, now),
            Session(unactivatedId, unactivatedDigest, now),
            Session(regularAccountId, regularDigest, now));
        identity.RoleAssignments.AddRange(
            SellerRole(ownerId, now), SellerRole(secondSellerId, now),
            SellerRole(serviceOnlySellerId, now),
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
        var serviceOnlyApplication = Application(
            serviceOnlySellerId, businessCategory, now, activated: true);
        serviceOnlyApplication.OfferingType = "SERVICE";
        seller.RegistrationDrafts.AddRange(
            Application(ownerId, businessCategory, now, activated: true),
            Application(secondSellerId, businessCategory, now, activated: true),
            serviceOnlyApplication,
            Application(unactivatedId, businessCategory, now, activated: false));
        await seller.SaveChangesAsync();

        var catalogCategoryId = Guid.NewGuid();
        var catalogCategoryName =
            "دسته آزمون " + Guid.NewGuid().ToString("N")[..8];
        var hiddenCatalogCategoryId = Guid.NewGuid();
        catalog.Categories.AddRange(
            new CategoryRecord
            {
                Id = catalogCategoryId,
                Name = catalogCategoryName,
                Slug = "seller-offer-" + Guid.NewGuid().ToString("N"),
                State = PublicationStates.Published,
                CreatedAtUtc = now
            },
            new CategoryRecord
            {
                Id = hiddenCatalogCategoryId,
                Name = "دسته منتشرنشده " + hiddenCatalogCategoryId.ToString("N")[..8],
                Slug = "seller-offer-hidden-" + Guid.NewGuid().ToString("N"),
                State = PublicationStates.Draft,
                CreatedAtUtc = now
            });
        var goodId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        var unpublishedId = Guid.NewGuid();
        var hiddenCategoryGoodId = Guid.NewGuid();
        catalog.Products.AddRange(
            Product(goodId, catalogCategoryId,
                CatalogProductKinds.Good, PublicationStates.Published, now),
            Product(serviceId, catalogCategoryId,
                CatalogProductKinds.Service, PublicationStates.Published, now),
            Product(unpublishedId, catalogCategoryId,
                CatalogProductKinds.Good, PublicationStates.Draft, now),
            Product(hiddenCategoryGoodId, hiddenCatalogCategoryId,
                CatalogProductKinds.Good, PublicationStates.Published, now));
        await catalog.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var owner = factory.CreateClient();
        using var second = factory.CreateClient();
        using var serviceOnly = factory.CreateClient();
        using var unactivated = factory.CreateClient();
        using var regular = factory.CreateClient();
        owner.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ownerToken);
        second.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", secondToken);
        serviceOnly.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", serviceOnlyToken);
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
        Assert.Equal(HttpStatusCode.Forbidden,
            (await serviceOnly.GetAsync(endpoint)).StatusCode);
        using (var serviceAccess = await serviceOnly.GetAsync(
            "/api/v1/seller/access"))
        {
            Assert.Equal(HttpStatusCode.OK, serviceAccess.StatusCode);
            using var serviceAccessJson = JsonDocument.Parse(
                await serviceAccess.Content.ReadAsStringAsync());
            Assert.False(serviceAccessJson.RootElement
                .GetProperty("capabilities").GetProperty("listings")
                .GetBoolean());
        }

        const string goodsEndpoint = "/api/v1/seller/catalog/goods";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(goodsEndpoint)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await regular.GetAsync(goodsEndpoint)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await unactivated.GetAsync(goodsEndpoint)).StatusCode);

        using (var goodsResponse = await owner.GetAsync(
            goodsEndpoint + "?page=1&pageSize=20"))
        {
            Assert.Equal(HttpStatusCode.OK, goodsResponse.StatusCode);
            Assert.Equal("no-store", goodsResponse.Headers.CacheControl?.ToString());
            using var goodsJson = JsonDocument.Parse(
                await goodsResponse.Content.ReadAsStringAsync());
            var goodsRoot = goodsJson.RootElement;
            Assert.Equal(1, goodsRoot.GetProperty("page").GetInt32());
            Assert.Equal(20, goodsRoot.GetProperty("pageSize").GetInt32());
            Assert.Equal(1, goodsRoot.GetProperty("total").GetInt32());
            var items = goodsRoot.GetProperty("items");
            var item = Assert.Single(items.EnumerateArray());
            Assert.Equal(goodId, item.GetProperty("id").GetGuid());
            Assert.Equal(catalogCategoryId, item.GetProperty("categoryId").GetGuid());
            Assert.Equal(catalogCategoryName, item.GetProperty("categoryName").GetString());
            Assert.Equal("کیلوگرم", item.GetProperty("unitName").GetString());
            Assert.Equal(3, item.GetProperty("quantityScale").GetInt32());
            Assert.Null(item.GetProperty("imageUrl").GetString());
            Assert.False(item.TryGetProperty("price", out _));
            Assert.False(item.TryGetProperty("kind", out _));
            var categories = goodsRoot.GetProperty("categories");
            var category = Assert.Single(categories.EnumerateArray());
            Assert.Equal(catalogCategoryId, category.GetProperty("id").GetGuid());
            Assert.Equal(catalogCategoryName, category.GetProperty("name").GetString());
        }

        using (var filteredResponse = await owner.GetAsync(
            goodsEndpoint + "?page=1&pageSize=20&categoryId=" +
            catalogCategoryId + "&search=" + Uri.EscapeDataString("کالای آزمون")))
        {
            Assert.Equal(HttpStatusCode.OK, filteredResponse.StatusCode);
            using var filteredJson = JsonDocument.Parse(
                await filteredResponse.Content.ReadAsStringAsync());
            Assert.Equal(1, filteredJson.RootElement.GetProperty("total").GetInt32());
        }

        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.GetAsync(goodsEndpoint + "?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.GetAsync(goodsEndpoint + "?search=" +
                Uri.EscapeDataString(new string('x', 81)))).StatusCode);

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

        var offerRoute = endpoint + "/" + offerId;
        using (var denied = MutationRequest(HttpMethod.Put, offerRoute,
            Guid.NewGuid(), new
            {
                expectedRevision = 1, priceRials = 1_250_000,
                sellableQuantity = 2.125m
            }))
            Assert.Equal(HttpStatusCode.Forbidden,
                (await unactivated.SendAsync(denied)).StatusCode);
        using (var crossSeller = MutationRequest(HttpMethod.Put, offerRoute,
            Guid.NewGuid(), new
            {
                expectedRevision = 1, priceRials = 1_250_000,
                sellableQuantity = 2.125m
            }))
            Assert.Equal(HttpStatusCode.NotFound,
                (await second.SendAsync(crossSeller)).StatusCode);

        var updateKey = Guid.NewGuid();
        using (var invalidPrecision = MutationRequest(HttpMethod.Put,
            offerRoute, Guid.NewGuid(), new
            {
                expectedRevision = 1, priceRials = 1_250_000,
                sellableQuantity = 2.1234m
            }))
            Assert.Equal(HttpStatusCode.Conflict,
                (await owner.SendAsync(invalidPrecision)).StatusCode);

        using var update = MutationRequest(HttpMethod.Put, offerRoute,
            updateKey, new
            {
                expectedRevision = 1, priceRials = 1_250_000,
                sellableQuantity = 2.125m
            });
        using var updated = await owner.SendAsync(update);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using (var updatedJson = JsonDocument.Parse(
            await updated.Content.ReadAsStringAsync()))
        {
            Assert.Equal("DRAFT", updatedJson.RootElement
                .GetProperty("status").GetString());
            Assert.Equal(2, updatedJson.RootElement
                .GetProperty("revision").GetInt32());
            Assert.Equal(1_250_000, updatedJson.RootElement
                .GetProperty("priceRials").GetInt64());
            Assert.Equal(2.125m, updatedJson.RootElement
                .GetProperty("sellableQuantity").GetDecimal());
        }
        using var updateRetry = MutationRequest(HttpMethod.Put, offerRoute,
            updateKey, new
            {
                expectedRevision = 1, priceRials = 1_250_000,
                sellableQuantity = 2.125m
            });
        Assert.Equal(HttpStatusCode.OK,
            (await owner.SendAsync(updateRetry)).StatusCode);
        Assert.Equal(1, await seller.OfferMutations.AsNoTracking()
            .CountAsync(x => x.OfferId == offerId));

        using var staleUpdate = MutationRequest(HttpMethod.Put, offerRoute,
            Guid.NewGuid(), new
            {
                expectedRevision = 1, priceRials = 1_300_000,
                sellableQuantity = 2.125m
            });
        Assert.Equal(HttpStatusCode.Conflict,
            (await owner.SendAsync(staleUpdate)).StatusCode);

        var publishKey = Guid.NewGuid();
        using var publish = MutationRequest(HttpMethod.Post,
            offerRoute + "/publish", publishKey,
            new { expectedRevision = 2 });
        using var published = await owner.SendAsync(publish);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        using (var publishedJson = JsonDocument.Parse(
            await published.Content.ReadAsStringAsync()))
        {
            Assert.Equal("PUBLISHED", publishedJson.RootElement
                .GetProperty("status").GetString());
            Assert.Equal(3, publishedJson.RootElement
                .GetProperty("revision").GetInt32());
        }
        using var publishRetry = MutationRequest(HttpMethod.Post,
            offerRoute + "/publish", publishKey,
            new { expectedRevision = 2 });
        Assert.Equal(HttpStatusCode.OK,
            (await owner.SendAsync(publishRetry)).StatusCode);
        Assert.Equal(2, await seller.OfferMutations.AsNoTracking()
            .CountAsync(x => x.OfferId == offerId));

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

        using var ownerListResponse = await owner.GetAsync(endpoint);
        Assert.Equal("no-store",
            ownerListResponse.Headers.CacheControl?.ToString());
        using var ownerListJson = JsonDocument.Parse(
            await ownerListResponse.Content.ReadAsStringAsync());
        var ownerItems = ownerListJson.RootElement.GetProperty("items");
        Assert.Single(ownerItems.EnumerateArray());
        var ownerItem = ownerItems[0];
        Assert.Equal(offerId, ownerItem.GetProperty("id").GetGuid());
        Assert.Equal("PUBLISHED", ownerItem.GetProperty("status").GetString());
        Assert.Equal(1_250_000, ownerItem.GetProperty("priceRials").GetInt64());
        Assert.Equal(2.125m, ownerItem.GetProperty("sellableQuantity").GetDecimal());
        var catalogProjection = ownerItem.GetProperty("catalogProduct");
        Assert.Equal(goodId, catalogProjection.GetProperty("id").GetGuid());
        Assert.Equal("کالای آزمون " + goodId.ToString("N")[..8],
            catalogProjection.GetProperty("name").GetString());
        Assert.Equal(catalogCategoryName,
            catalogProjection.GetProperty("categoryName").GetString());
        Assert.Equal("توضیح Catalog آزمون " + goodId.ToString("N")[..8],
            catalogProjection.GetProperty("description").GetString());
        Assert.Equal("کیلوگرم",
            catalogProjection.GetProperty("unitName").GetString());
        Assert.Equal(3,
            catalogProjection.GetProperty("quantityScale").GetInt32());
        Assert.Equal(JsonValueKind.Null,
            catalogProjection.GetProperty("imageUrl").ValueKind);
        Assert.False(catalogProjection.TryGetProperty("price", out _));
        Assert.False(catalogProjection.TryGetProperty("quantity", out _));

        var secondList = await second.GetFromJsonAsync<JsonElement>(endpoint);
        Assert.Empty(secondList.GetProperty("items").EnumerateArray());

        var stored = await seller.OfferDrafts.AsNoTracking().ToListAsync();
        var only = Assert.Single(stored.Where(x => x.Id == offerId));
        Assert.Equal(ownerId, only.SellerAccountId);
        Assert.Equal(goodId, only.CatalogProductId);
        Assert.Equal(SellerOfferDraftStates.Published, only.Status);
        Assert.Equal(3, only.Revision);
        Assert.Equal(1_250_000L, only.PriceRials);
        Assert.Equal((decimal?)2.125m, only.SellableQuantity);
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

        seller.OfferDrafts.AddRange(
            new SellerOfferDraftRecord
            {
                Id = Guid.NewGuid(), SellerAccountId = secondSellerId,
                CatalogProductId = goodId, Status = SellerOfferDraftStates.Paused,
                Revision = 3, IdempotencyKey = Guid.NewGuid(),
                PriceRials = 1_100_000, SellableQuantity = 1,
                CreatedAtUtc = now, UpdatedAtUtc = now
            },
            new SellerOfferDraftRecord
            {
                Id = Guid.NewGuid(), SellerAccountId = serviceOnlySellerId,
                CatalogProductId = goodId, Status = SellerOfferDraftStates.Published,
                Revision = 3, IdempotencyKey = Guid.NewGuid(),
                PriceRials = 1_300_000, SellableQuantity = 1,
                CreatedAtUtc = now, UpdatedAtUtc = now
            },
            new SellerOfferDraftRecord
            {
                Id = Guid.NewGuid(), SellerAccountId = unactivatedId,
                CatalogProductId = goodId, Status = SellerOfferDraftStates.Published,
                Revision = 3, IdempotencyKey = Guid.NewGuid(),
                PriceRials = 1_400_000, SellableQuantity = 1,
                CreatedAtUtc = now, UpdatedAtUtc = now
            });
        await seller.SaveChangesAsync();

        using (var publicOffersResponse = await anonymous.GetAsync(
            "/api/v1/catalog/products/" + goodId + "/offers?page=1&pageSize=10"))
        {
            Assert.Equal(HttpStatusCode.OK, publicOffersResponse.StatusCode);
            Assert.Equal("no-store",
                publicOffersResponse.Headers.CacheControl?.ToString());
            using var publicOffersJson = JsonDocument.Parse(
                await publicOffersResponse.Content.ReadAsStringAsync());
            var publicOffersRoot = publicOffersJson.RootElement;
            Assert.Equal(1, publicOffersRoot.GetProperty("total").GetInt32());
            var publicOffer = Assert.Single(
                publicOffersRoot.GetProperty("items").EnumerateArray());
            Assert.Equal(offerId, publicOffer.GetProperty("id").GetGuid());
            Assert.Equal("فروشگاه آزمون",
                publicOffer.GetProperty("sellerName").GetString());
            Assert.Equal(1_250_000,
                publicOffer.GetProperty("priceRials").GetInt64());
            Assert.Equal(2.125m,
                publicOffer.GetProperty("sellableQuantity").GetDecimal());
            Assert.Equal("کیلوگرم",
                publicOffer.GetProperty("unitName").GetString());
            Assert.Equal(3,
                publicOffer.GetProperty("quantityScale").GetInt32());
            Assert.False(publicOffer.TryGetProperty("sellerAccountId", out _));
            Assert.False(publicOffer.TryGetProperty("status", out _));
        }

        Assert.Equal(HttpStatusCode.NotFound,
            (await anonymous.GetAsync("/api/v1/catalog/products/" +
                serviceId + "/offers")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await anonymous.GetAsync("/api/v1/catalog/products/" +
                goodId + "/offers?pageSize=51")).StatusCode);

        // A draft reference survives Catalog unpublication, while the live
        // Catalog projection is omitted rather than serving stale identity.
        var goodProduct = await catalog.Products.SingleAsync(
            x => x.Id == goodId);
        goodProduct.State = PublicationStates.Draft;
        await catalog.SaveChangesAsync();
        using var unpublishedListResponse = await owner.GetAsync(endpoint);
        using var unpublishedListJson = JsonDocument.Parse(
            await unpublishedListResponse.Content.ReadAsStringAsync());
        var retainedDraft = Assert.Single(
            unpublishedListJson.RootElement.GetProperty("items")
                .EnumerateArray());
        Assert.Equal(offerId, retainedDraft.GetProperty("id").GetGuid());
        Assert.Equal(JsonValueKind.Null,
            retainedDraft.GetProperty("catalogProduct").ValueKind);

        // This suite shares the CI PostgreSQL database with Catalog read tests.
        await seller.OfferMutations.Where(x =>
            x.OfferId == offerId).ExecuteDeleteAsync();
        await seller.OfferDrafts.Where(x =>
            x.SellerAccountId == ownerId ||
            x.SellerAccountId == secondSellerId ||
            x.SellerAccountId == serviceOnlySellerId ||
            x.SellerAccountId == unactivatedId).ExecuteDeleteAsync();
        await seller.RegistrationDrafts.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == serviceOnlySellerId ||
            x.AccountId == unactivatedId).ExecuteDeleteAsync();
        await seller.BusinessCategories
            .Where(x => x.Id == businessCategory).ExecuteDeleteAsync();
        await catalog.Products.Where(x =>
            x.Id == goodId || x.Id == serviceId ||
            x.Id == unpublishedId || x.Id == hiddenCategoryGoodId)
            .ExecuteDeleteAsync();
        await catalog.Categories
            .Where(x => x.Id == catalogCategoryId ||
                x.Id == hiddenCatalogCategoryId).ExecuteDeleteAsync();
        await identity.AuthSessions.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == serviceOnlySellerId ||
            x.AccountId == unactivatedId ||
            x.AccountId == regularAccountId).ExecuteDeleteAsync();
        await identity.RoleAssignments.Where(x =>
            x.AccountId == ownerId ||
            x.AccountId == secondSellerId ||
            x.AccountId == serviceOnlySellerId ||
            x.AccountId == unactivatedId).ExecuteDeleteAsync();
        await identity.Accounts.Where(x =>
            x.Id == ownerId ||
            x.Id == secondSellerId ||
            x.Id == serviceOnlySellerId ||
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

    private static HttpRequestMessage MutationRequest(
        HttpMethod method, string endpoint, Guid key, object body)
    {
        var request = new HttpRequestMessage(method, endpoint)
        {
            Content = JsonContent.Create(body)
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
        Description = "توضیح Catalog آزمون " + id.ToString("N")[..8],
        UnitName = kind == CatalogProductKinds.Good ? "کیلوگرم" : null,
        QuantityScale = kind == CatalogProductKinds.Good ? (short)3 : null,
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
