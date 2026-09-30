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

/// <summary>
/// CI-only: real ASP.NET routes + real PostgreSQL + seeded verified accounts.
/// Never register a token-minting or fake SMS endpoint in the shipping API.
/// </summary>
public sealed class SellerRegistrationApiTests
{
    [Fact]
    public async Task AuthenticatedDraftIsPersistedScopedEditableAndRevocable()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return; // CI configures real ephemeral PostgreSQL.

        var options = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var identity = new HanaIdentityDbContext(options);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var firstPhone = NewPhone();
        var secondPhone = NewPhone();
        // No OTP bypass: directly seed hashed sessions solely in disposable CI DB.
        var firstToken = SessionTokenCodec.Generate();
        var secondToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(firstToken, out var firstHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(secondToken, out var secondHash));

        identity.Accounts.AddRange(
            new AccountRecord
            {
                Id = firstId, NormalizedPhone = firstPhone,
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            },
            new AccountRecord
            {
                Id = secondId, NormalizedPhone = secondPhone,
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            });
        identity.AuthSessions.AddRange(
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = firstId, TokenDigest = firstHash,
                IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            },
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = secondId, TokenDigest = secondHash,
                IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            });
        await identity.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var anon = factory.CreateClient();
        using var first = factory.CreateClient();
        using var second = factory.CreateClient();
        first.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", firstToken);
        second.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", secondToken);
        const string url = "/api/v1/seller/registration";
        var draft = Fields(firstPhone, "فروشگاه اول", revision: 0);

        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await first.GetAsync(url)).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(url, new
            {
                storeName = "مجاز", ownerName = "مسئول", phone = firstPhone,
                city = "تهران", address = "نشانی", postalCode = "1234567890"
            })).StatusCode);

        var saved = await first.PutAsJsonAsync(url, draft);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal("no-store", saved.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(await saved.Content.ReadAsStringAsync()))
        {
            Assert.Equal("DRAFT", body.RootElement.GetProperty("status").GetString());
            Assert.Equal(1, body.RootElement.GetProperty("revision").GetInt32());
        }

        var owned = await first.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, owned.StatusCode);
        Assert.Equal("no-store", owned.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(await owned.Content.ReadAsStringAsync()))
        {
            Assert.Equal("فروشگاه اول",
                body.RootElement.GetProperty("storeName").GetString());
            Assert.Equal(firstPhone,
                body.RootElement.GetProperty("phone").GetString());
            Assert.Equal("DRAFT",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(1, body.RootElement.GetProperty("revision").GetInt32());
            Assert.False(body.RootElement.TryGetProperty("accountId", out _));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await second.GetAsync(url)).StatusCode);

        // An otherwise authenticated user cannot replace their verified
        // account phone with a different number on this form.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await second.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await second.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, "invalid", "123", revision: 1))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, new string('X', 121), revision: 1))).StatusCode);

        // An outdated browser tab cannot overwrite an already-saved draft.
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PutAsJsonAsync(
                url, Fields(firstPhone, "نسخهٔ قدیمی", revision: 0))).StatusCode);
        var updated = await first.PutAsJsonAsync(
            url, Fields(firstPhone, "فروشگاه ویرایش‌شده", revision: 1));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using (var body = JsonDocument.Parse(await updated.Content.ReadAsStringAsync()))
            Assert.Equal(2, body.RootElement.GetProperty("revision").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PutAsJsonAsync(
                url, Fields(firstPhone, "ویرایش قدیمی", revision: 1))).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await second.PutAsJsonAsync(
                url, Fields(secondPhone, "فروشگاه دوم", revision: 0))).StatusCode);

        // Two simultaneous API requests carrying the same revision must
        // never both succeed, even if handled by different DB contexts.
        var concurrent = await Task.WhenAll(
            first.PutAsJsonAsync(url,
                Fields(firstPhone, "گزینه الف", revision: 2)),
            first.PutAsJsonAsync(url,
                Fields(firstPhone, "گزینه ب", revision: 2)));
        Assert.Single(concurrent, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(concurrent, x => x.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, "نسخه دیرهنگام", revision: 2))).StatusCode);

        var one = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == firstId);
        var two = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == secondId);
        Assert.Contains(one.StoreName, new[] { "گزینه الف", "گزینه ب" });
        Assert.Equal(firstPhone, one.Phone);
        Assert.Equal("فروشگاه دوم", two.StoreName);
        Assert.Equal(2, await seller.RegistrationDrafts.CountAsync(
            x => x.AccountId == firstId || x.AccountId == secondId));
        Assert.Equal("DRAFT", one.Status);
        Assert.Equal("DRAFT", two.Status);
        Assert.Equal(3, one.Revision);
        Assert.Equal(1, two.Revision);

        // Figma step 2: applicant type is account-scoped, revisioned and
        // cannot be skipped by calling submit directly.
        const string applicantUrl = url + "/applicant-type";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync(applicantUrl,
                new { applicantType = "OTHER", revision = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.PutAsJsonAsync(applicantUrl,
                new { applicantType = "NATURAL", revision = 3 })).StatusCode);

        var applicantSaved = await first.PutAsJsonAsync(applicantUrl,
            new { applicantType = "NATURAL", revision = 3 });
        Assert.Equal(HttpStatusCode.OK, applicantSaved.StatusCode);
        using (var body = JsonDocument.Parse(
            await applicantSaved.Content.ReadAsStringAsync()))
        {
            Assert.Equal("NATURAL",
                body.RootElement.GetProperty("applicantType").GetString());
            Assert.Equal(2,
                body.RootElement.GetProperty("completedStep").GetInt32());
            Assert.Equal(4,
                body.RootElement.GetProperty("revision").GetInt32());
        }
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PutAsJsonAsync(applicantUrl,
                new { applicantType = "LEGAL", revision = 3 })).StatusCode);

        var incompleteKey = Guid.NewGuid();
        using (var incompleteRequest = new HttpRequestMessage(
            HttpMethod.Post, url + "/submit")
        {
            Content = JsonContent.Create(new { revision = 4 })
        })
        {
            incompleteRequest.Headers.Add(
                "Idempotency-Key", incompleteKey.ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await first.SendAsync(incompleteRequest)).StatusCode);
        }

        // Later Seller slices own steps 3..6. Seed only the progress marker
        // in disposable CI DB so this test can continue covering Seller 005
        // submit idempotency without inventing production identity data.
        await seller.RegistrationDrafts
            .Where(x => x.AccountId == firstId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.NaturalNationalCode, "0084575948")
                .SetProperty(x => x.IdentityStatus, "VERIFIED")
                .SetProperty(x => x.CompletedStep, 6));

        // The Figma "review and submit" step is a single atomic transition.
        // It grants no seller permission; it only freezes this registration
        // version for a later reviewer workflow.
        var submissionKey = Guid.NewGuid();
        async Task<HttpResponseMessage> Submit(Guid key, int revision)
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, url + "/submit")
            {
                Content = JsonContent.Create(new { revision })
            };
            request.Headers.Add("Idempotency-Key", key.ToString());
            return await first.SendAsync(request);
        }

        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PostAsJsonAsync(url + "/submit",
                new { revision = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await Submit(submissionKey, revision: 4)).StatusCode);
        // Lost-response retry with the same key and expected revision
        // converges on the same submitted row.
        Assert.Equal(HttpStatusCode.OK,
            (await Submit(submissionKey, revision: 4)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await Submit(Guid.NewGuid(), revision: 4)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PutAsJsonAsync(url,
                Fields(firstPhone, "ویرایش پس از ثبت", revision: 5))).StatusCode);

        var submitted = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == firstId);
        Assert.Equal("SUBMITTED", submitted.Status);
        Assert.Equal(5, submitted.Revision);
        Assert.Equal(submissionKey, submitted.SubmissionKey);
        Assert.Equal(4, submitted.SubmissionExpectedRevision);
        Assert.NotNull(submitted.SubmittedAtUtc);

        var submittedRead = await first.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, submittedRead.StatusCode);
        using (var body = JsonDocument.Parse(
            await submittedRead.Content.ReadAsStringAsync()))
        {
            Assert.Equal("SUBMITTED",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(5, body.RootElement.GetProperty("revision").GetInt32());
            Assert.True(body.RootElement.TryGetProperty("submittedAtUtc", out _));
            Assert.False(body.RootElement.TryGetProperty("submissionKey", out _));
        }

        await identity.AuthSessions
            .Where(x => x.AccountId == firstId)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(x => x.RevokedAtUtc, DateTimeOffset.UtcNow));
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await first.PutAsJsonAsync(url, draft)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await second.GetAsync(url)).StatusCode);
    }

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);

    private static object Fields(string phone, string name,
        string postalCode = "1234567890", int revision = 0) => new
        {
            storeName = name, ownerName = "مسئول",
            phone, city = "تهران", address = "نشانی آزمایشی",
            postalCode, revision
        };
}
