using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class AdminSellerApplicationApiTests
{
    [Fact]
    public async Task OnlyExplicitAdminCanReadSubmittedSellerApplications()
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
        var adminId = Guid.NewGuid();
        var ordinaryId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var draftOnlyId = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var ordinaryToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(adminToken, out var adminHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            ordinaryToken, out var ordinaryHash));

        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(ordinaryId, NewPhone(), now),
            Account(applicantId, NewPhone(), now),
            Account(draftOnlyId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminHash, now),
            Session(ordinaryId, ordinaryHash, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord
        {
            AccountId = adminId,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        await identity.SaveChangesAsync();

        var businessCategoryId = Guid.NewGuid();
        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = businessCategoryId,
            Name = "دسته‌بندی درخواست ثبت‌شده",
            IsActive = true,
            UpdatedAtUtc = now
        });

        seller.RegistrationDrafts.AddRange(
            new SellerRegistrationDraft
            {
                AccountId = applicantId,
                StoreName = "فروشگاه ثبت‌شده",
                OwnerName = "مسئول ثبت‌شده",
                Phone = "09123456789",
                City = "تهران",
                Address = "نشانی ثبت‌شده",
                PostalCode = "1234567890",
                ApplicantType = "NATURAL",
                NaturalNationalCode = "0084575948",
                IdentityStatus = "VERIFIED",
                BusinessCategoryId = businessCategoryId,
                BusinessName = "کسب‌وکار ثبت‌شده",
                BusinessDescription = "توضیح کسب‌وکار ثبت‌شده",
                BusinessPhone = "02112345678",
                OfferingType = "GOOD",
                ActivityProvinceId = Guid.NewGuid(),
                ActivityCityId = Guid.NewGuid(),
                ActivityAddress = "نشانی فعالیت ثبت‌شده",
                ActivityHours = "۸ تا ۲۲",
                SellerDelivery = true,
                Pickup = true,
                ServiceArea = "کل شهر",
                CompletedStep = 6,
                Status = "SUBMITTED",
                Revision = 2,
                SubmissionKey = Guid.NewGuid(),
                SubmissionExpectedRevision = 1,
                SubmittedAtUtc = now.AddMinutes(-5),
                UpdatedAtUtc = now.AddMinutes(-5)
            },
            new SellerRegistrationDraft
            {
                AccountId = draftOnlyId,
                StoreName = "پیش‌نویس خصوصی",
                OwnerName = "مسئول پیش‌نویس",
                Phone = "09999999999",
                City = "شیراز",
                Address = "نشانی پیش‌نویس",
                PostalCode = "9876543210",
                Status = "DRAFT",
                Revision = 1,
                UpdatedAtUtc = now
            });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var anon = factory.CreateClient();
        using var ordinary = factory.CreateClient();
        using var admin = factory.CreateClient();
        ordinary.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ordinaryToken);
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", adminToken);

        const string listUrl = "/api/v1/admin/seller-applications";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.GetAsync(listUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ordinary.GetAsync(listUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.GetAsync(listUrl + "?pageSize=51")).StatusCode);

        var list = await admin.GetAsync(listUrl);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal("no-store",
            list.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(
            await list.Content.ReadAsStringAsync()))
        {
            var items = body.RootElement.GetProperty("items")
                .EnumerateArray().ToArray();
            var item = Assert.Single(items.Where(x =>
                x.GetProperty("applicationId").GetGuid() == applicantId));
            Assert.Equal("SUBMITTED",
                item.GetProperty("status").GetString());
            Assert.False(item.TryGetProperty("phone", out _));
            Assert.False(item.TryGetProperty("submissionKey", out _));
            Assert.True(body.RootElement.GetProperty("total").GetInt32() >= 1);
        }

        var detail = await admin.GetAsync(
            listUrl + "/" + applicantId);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        using (var body = JsonDocument.Parse(
            await detail.Content.ReadAsStringAsync()))
        {
            Assert.Equal("فروشگاه ثبت‌شده",
                body.RootElement.GetProperty("storeName").GetString());
            Assert.Equal("0912*******",
                body.RootElement.GetProperty("phoneMasked").GetString());
            Assert.Equal("SUBMITTED",
                body.RootElement.GetProperty("status").GetString());
            Assert.False(body.RootElement.TryGetProperty("submissionKey", out _));
            Assert.False(body.RootElement.TryGetProperty(
                "submissionExpectedRevision", out _));
        }

        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.GetAsync(listUrl + "/" + draftOnlyId)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ordinary.GetAsync(
                listUrl + "/" + applicantId)).StatusCode);
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
            .ToString("D9", CultureInfo.InvariantCulture);
}
