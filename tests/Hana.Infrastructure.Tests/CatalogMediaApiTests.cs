using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hana.Infrastructure.Tests;

[Collection("CatalogDatabase")]
public sealed class CatalogMediaApiTests
{
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    [Fact]
    public async Task OnlyExplicitAdminCanUploadReviewAndExposeCatalogMedia()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var catalogOptions = new DbContextOptionsBuilder<HanaCatalogDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "catalog"))
            .Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var catalog = new HanaCatalogDbContext(catalogOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await catalog.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var adminId = Guid.NewGuid();
        var ordinaryId = Guid.NewGuid();
        var adminToken = SessionTokenCodec.Generate();
        var ordinaryToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(ordinaryToken, out var ordinaryDigest));

        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(ordinaryId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminDigest, now),
            Session(ordinaryId, ordinaryDigest, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord
        {
            AccountId = adminId,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        await identity.SaveChangesAsync();

        var categoryId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        catalog.Categories.Add(new CategoryRecord
        {
            Id = categoryId,
            Name = "دستهٔ رسانهٔ CI",
            Slug = "ci-media-" + categoryId.ToString("N"),
            State = PublicationStates.Published,
            CreatedAtUtc = now
        });
        catalog.Products.Add(new ProductRecord
        {
            Id = productId,
            CategoryId = categoryId,
            Name = "کالای رسانهٔ CI",
            Kind = CatalogProductKinds.Good,
            Description = null,
            State = PublicationStates.Published,
            CreatedAtUtc = now
        });
        await catalog.SaveChangesAsync();

        var objectStore = new InMemoryCatalogMediaStorage();
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<ICatalogMediaStorage>();
                    services.AddSingleton<ICatalogMediaStorage>(objectStore);
                });
            });
        using var anonymous = factory.CreateClient();
        using var ordinary = factory.CreateClient();
        using var admin = factory.CreateClient();
        ordinary.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ordinaryToken);
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", adminToken);

        var uploadUrl = $"/api/v1/admin/catalog/products/{productId}/media";
        var uploadKey = Guid.NewGuid();
        using (var response = await UploadAsync(anonymous, uploadUrl, uploadKey))
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using (var response = await UploadAsync(ordinary, uploadUrl, uploadKey))
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        Guid assetId;
        using (var response = await UploadAsync(admin, uploadUrl, uploadKey))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("no-store", response.Headers.GetValues("Cache-Control").Single());
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            assetId = body.RootElement.GetProperty("assetId").GetGuid();
            Assert.Equal("PENDING_REVIEW",
                body.RootElement.GetProperty("reviewStatus").GetString());
            Assert.Equal(1, body.RootElement.GetProperty("revision").GetInt32());
            Assert.False(body.RootElement.TryGetProperty("objectKey", out _));
        }

        using (var replay = await UploadAsync(admin, uploadUrl, uploadKey))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
            using var body = JsonDocument.Parse(await replay.Content.ReadAsStringAsync());
            Assert.Equal(assetId, body.RootElement.GetProperty("assetId").GetGuid());
        }
        Assert.Single(objectStore.Objects);

        var publicUrl = $"/api/v1/catalog/media/{assetId}";
        Assert.Equal(HttpStatusCode.NotFound,
            (await anonymous.GetAsync(publicUrl)).StatusCode);

        var reviewUrl = $"/api/v1/admin/catalog/media/{assetId}/review";
        var reviewKey = Guid.NewGuid();
        using var review = new HttpRequestMessage(HttpMethod.Post, reviewUrl)
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "APPROVED",
                reason = (string?)null
            })
        };
        review.Headers.Add("Idempotency-Key", reviewKey.ToString());
        using (var response = await admin.SendAsync(review))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("APPROVED",
                body.RootElement.GetProperty("reviewStatus").GetString());
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
        }

        using (var replay = new HttpRequestMessage(HttpMethod.Post, reviewUrl)
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "APPROVED",
                reason = (string?)null
            })
        })
        {
            replay.Headers.Add("Idempotency-Key", reviewKey.ToString());
            using var response = await admin.SendAsync(replay);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
        }

        using (var stale = new HttpRequestMessage(HttpMethod.Post, reviewUrl)
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "REJECTED",
                reason = "تلاش نسخهٔ قدیمی"
            })
        })
        {
            stale.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(stale)).StatusCode);
        }

        Assert.Equal(1, await catalog.MediaReviews.AsNoTracking()
            .CountAsync(x => x.AssetId == assetId));
        Assert.Equal(assetId, (await catalog.Products.AsNoTracking()
            .SingleAsync(x => x.Id == productId)).PrimaryMediaAssetId);

        using (var image = await anonymous.GetAsync(publicUrl))
        {
            Assert.Equal(HttpStatusCode.OK, image.StatusCode);
            Assert.Equal("image/png", image.Content.Headers.ContentType?.MediaType);
            Assert.Equal("nosniff",
                image.Headers.GetValues("X-Content-Type-Options").Single());
            Assert.Equal("no-store", image.Headers.GetValues("Cache-Control").Single());
            Assert.Equal(TinyPng, await image.Content.ReadAsByteArrayAsync());
        }

        using (var product = await anonymous.GetAsync(
            $"/api/v1/catalog/products/{productId}"))
        {
            Assert.Equal(HttpStatusCode.OK, product.StatusCode);
            using var body = JsonDocument.Parse(
                await product.Content.ReadAsStringAsync());
            Assert.Equal(publicUrl,
                body.RootElement.GetProperty("imageUrl").GetString());
            Assert.False(body.RootElement.TryGetProperty("primaryMediaAssetId", out _));
        }

        await catalog.Products.Where(x => x.Id == productId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                x => x.State, PublicationStates.Draft));
        Assert.Equal(HttpStatusCode.NotFound,
            (await anonymous.GetAsync(publicUrl)).StatusCode);
    }

    private static async Task<HttpResponseMessage> UploadAsync(
        HttpClient client, string url, Guid idempotencyKey)
    {
        using var form = new MultipartFormDataContent();
        using var file = new ByteArrayContent(TinyPng);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "image", "ignored.png");
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = form
        };
        request.Headers.Add("Idempotency-Key", idempotencyKey.ToString());
        return await client.SendAsync(request);
    }

    private static AccountRecord Account(
        Guid id, string phone, DateTimeOffset now) => new()
    {
        Id = id,
        NormalizedPhone = phone,
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

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", System.Globalization.CultureInfo.InvariantCulture);

    private sealed class InMemoryCatalogMediaStorage : ICatalogMediaStorage
    {
        public ConcurrentDictionary<string, (string Type, byte[] Bytes)> Objects { get; } = new();

        public Task PutAsync(string key, string contentType, byte[] bytes,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Objects[key] = (contentType, bytes.ToArray());
            return Task.CompletedTask;
        }

        public Task<byte[]?> ReadAsync(string key, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(Objects.TryGetValue(key, out var stored)
                ? stored.Bytes.ToArray() : null);
        }
    }
}
