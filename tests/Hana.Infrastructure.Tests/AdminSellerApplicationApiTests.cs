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
                RegistrationContactName = "مسئول ثبت‌شده",
                RegistrationContactRole = "مدیر فروش",
                BackupPhone = "09123456780",
                WebsiteOrSocial = "instagram.com/admin-ci",
                BusinessEmail = "admin@example.com",
                ResponseHours = "۸ تا ۲۲",
                CompletedStep = 6,
                Status = "SUBMITTED",
                Revision = 2,
                SubmissionKey = Guid.NewGuid(),
                SubmissionExpectedRevision = 1,
                SubmittedAtUtc = now.AddMinutes(-5),
                AccuracyConfirmedAtUtc = now.AddMinutes(-5),
                TrackingCode = "HNA-A1B2C3D4E5F60718",
                ReviewStatus = "UNDER_REVIEW",
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
            Assert.Equal("UNDER_REVIEW",
                item.GetProperty("reviewStatus").GetString());
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
            Assert.Equal("مسئول ثبت‌شده",
                body.RootElement.GetProperty("registrationContactName").GetString());
            Assert.Equal("مدیر فروش",
                body.RootElement.GetProperty("registrationContactRole").GetString());
            Assert.Equal("0912*******",
                body.RootElement.GetProperty("backupPhoneMasked").GetString());
            Assert.Equal("admin@example.com",
                body.RootElement.GetProperty("businessEmail").GetString());
            Assert.Equal("۸ تا ۲۲",
                body.RootElement.GetProperty("responseHours").GetString());
            Assert.False(body.RootElement
                .GetProperty("documentsRequired").GetBoolean());
            Assert.False(body.RootElement.TryGetProperty("submissionKey", out _));
            Assert.False(body.RootElement.TryGetProperty(
                "submissionExpectedRevision", out _));
            Assert.Equal("UNDER_REVIEW",
                body.RootElement.GetProperty("reviewStatus").GetString());
        }

        // APPROVED may omit a reason; REJECTED requires one.
        // Use a DRAFT application so validation can be exercised without
        // consuming the real submitted application used below.
        using (var approvedProbe = new HttpRequestMessage(
            HttpMethod.Post, listUrl + "/" + draftOnlyId + "/review")
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "APPROVED",
                reason = (string?)null
            })
        })
        {
            approvedProbe.Headers.Add("Idempotency-Key",
                Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(approvedProbe)).StatusCode);
        }

        using (var rejectedWithoutReason = new HttpRequestMessage(
            HttpMethod.Post, listUrl + "/" + draftOnlyId + "/review")
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "REJECTED",
                reason = (string?)null
            })
        })
        {
            rejectedWithoutReason.Headers.Add("Idempotency-Key",
                Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.BadRequest,
                (await admin.SendAsync(rejectedWithoutReason)).StatusCode);
        }

        using (var rejectedProbe = new HttpRequestMessage(
            HttpMethod.Post, listUrl + "/" + draftOnlyId + "/review")
        {
            Content = JsonContent.Create(new
            {
                revision = 1,
                decision = "REJECTED",
                reason = "عدم احراز شرایط پرونده"
            })
        })
        {
            rejectedProbe.Headers.Add("Idempotency-Key",
                Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(rejectedProbe)).StatusCode);
        }

        var reviewUrl = listUrl + "/" + applicantId + "/review";
        var decisionKey = Guid.NewGuid();

        using (var missingReason = new HttpRequestMessage(
            HttpMethod.Post, reviewUrl)
        {
            Content = JsonContent.Create(new
            {
                revision = 2,
                decision = "NEEDS_INFORMATION",
                reason = (string?)null
            })
        })
        {
            missingReason.Headers.Add("Idempotency-Key",
                Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.BadRequest,
                (await admin.SendAsync(missingReason)).StatusCode);
        }

        using (var forbiddenReview = new HttpRequestMessage(
            HttpMethod.Post, reviewUrl)
        {
            Content = JsonContent.Create(new
            {
                revision = 2,
                decision = "REJECTED",
                reason = "دلیل تست"
            })
        })
        {
            forbiddenReview.Headers.Add("Idempotency-Key",
                Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Forbidden,
                (await ordinary.SendAsync(forbiddenReview)).StatusCode);
        }

        async Task<HttpResponseMessage> Review(
            Guid key, int revision, string decision, string? reason)
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, reviewUrl)
            {
                Content = JsonContent.Create(new
                {
                    revision,
                    decision,
                    reason
                })
            };
            request.Headers.Add("Idempotency-Key", key.ToString());
            return await admin.SendAsync(request);
        }

        var reviewedResponse = await Review(
            decisionKey, 2, "NEEDS_INFORMATION",
            "مدرک مجوز فعالیت باید تکمیل شود.");
        Assert.Equal(HttpStatusCode.OK, reviewedResponse.StatusCode);
        using (var body = JsonDocument.Parse(
            await reviewedResponse.Content.ReadAsStringAsync()))
        {
            Assert.Equal("NEEDS_INFORMATION",
                body.RootElement.GetProperty("reviewStatus").GetString());
            Assert.Equal(3,
                body.RootElement.GetProperty("revision").GetInt32());
            Assert.False(body.RootElement
                .GetProperty("sellerActivated").GetBoolean());
        }

        // Lost-response retry is idempotent.
        Assert.Equal(HttpStatusCode.OK,
            (await Review(decisionKey, 2, "NEEDS_INFORMATION",
                "مدرک مجوز فعالیت باید تکمیل شود.")).StatusCode);

        // A second decision on the same reviewed application is not allowed.
        Assert.Equal(HttpStatusCode.Conflict,
            (await Review(Guid.NewGuid(), 3, "APPROVED", null)).StatusCode);

        var reviewed = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == applicantId);
        Assert.Equal("SUBMITTED", reviewed.Status);
        Assert.Equal("NEEDS_INFORMATION", reviewed.ReviewStatus);
        Assert.Equal("مدرک مجوز فعالیت باید تکمیل شود.",
            reviewed.ReviewReason);
        Assert.Equal(adminId, reviewed.ReviewedByAccountId);
        Assert.NotNull(reviewed.ReviewedAtUtc);
        Assert.Equal(3, reviewed.Revision);

        var audit = Assert.Single(await seller.ApplicationReviews.AsNoTracking()
            .Where(x => x.ApplicationAccountId == applicantId)
            .ToListAsync());
        Assert.Equal(decisionKey, audit.DecisionKey);
        Assert.Equal(adminId, audit.ReviewerAccountId);
        Assert.Equal("NEEDS_INFORMATION", audit.Decision);
        Assert.Equal(2, audit.ExpectedRevision);

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
