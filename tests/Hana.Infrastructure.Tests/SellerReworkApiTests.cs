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

public sealed class SellerReworkApiTests
{
    [Fact]
    public async Task NeedsInformationCanReopenCorrectAndResubmitWithoutChangingIdentity()
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
        var applicantId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var applicantToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            applicantToken, out var applicantDigest));

        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(applicantId, "09123456789", now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminDigest, now),
            Session(applicantId, applicantDigest, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord
        {
            AccountId = adminId,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        await identity.SaveChangesAsync();

        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = categoryId,
            Name = "دسته‌بندی چرخه اصلاح " + Guid.NewGuid().ToString("N")[..8],
            IsActive = true,
            UpdatedAtUtc = now
        });
        seller.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = applicantId,
            StoreName = "فروشگاه چرخه اصلاح",
            OwnerName = "مالک چرخه اصلاح",
            Phone = "09123456789",
            City = "تهران",
            Address = "نشانی ثبت‌شده",
            PostalCode = "1234567890",
            ApplicantType = "NATURAL",
            NaturalNationalCode = "0084575948",
            IdentityStatus = "VERIFIED",
            BusinessCategoryId = categoryId,
            BusinessName = "کسب‌وکار چرخه اصلاح",
            BusinessDescription = "توضیح ثبت‌شده",
            BusinessPhone = "02112345678",
            OfferingType = "BOTH",
            ActivityProvinceId = Guid.NewGuid(),
            ActivityCityId = Guid.NewGuid(),
            ActivityAddress = "نشانی فعالیت",
            ActivityHours = "۸ تا ۲۲",
            SellerDelivery = true,
            Pickup = true,
            ServiceArea = "کل شهر",
            RegistrationContactName = "مسئول ثبت",
            RegistrationContactRole = "مدیر فروش",
            BackupPhone = "09123456780",
            WebsiteOrSocial = "example.com/hana",
            BusinessEmail = "seller@example.com",
            ResponseHours = "۸ تا ۲۲",
            CompletedStep = 6,
            Status = "SUBMITTED",
            Revision = 2,
            SubmissionKey = Guid.NewGuid(),
            SubmissionExpectedRevision = 1,
            SubmittedAtUtc = now.AddMinutes(-15),
            AccuracyConfirmedAtUtc = now.AddMinutes(-15),
            TrackingCode = "HNA-1234567890ABCDEF",
            ReviewStatus = "UNDER_REVIEW",
            UpdatedAtUtc = now.AddMinutes(-15)
        });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var admin = factory.CreateClient();
        using var applicant = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", adminToken);
        applicant.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", applicantToken);

        var reviewUrl =
            $"/api/v1/admin/seller-applications/{applicantId}/review";
        async Task<HttpResponseMessage> Review(
            Guid key, int revision, string decision, string? reason)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, reviewUrl)
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

        var needsInfoKey = Guid.NewGuid();
        var needsInfo = await Review(
            needsInfoKey,
            revision: 2,
            decision: "NEEDS_INFORMATION",
            reason: "ساعات پاسخگویی باید دقیق‌تر ثبت شود.");
        Assert.Equal(HttpStatusCode.OK, needsInfo.StatusCode);

        var statusBefore = await applicant.GetAsync(
            "/api/v1/seller/registration/status");
        Assert.Equal(HttpStatusCode.OK, statusBefore.StatusCode);
        using (var body = JsonDocument.Parse(
            await statusBefore.Content.ReadAsStringAsync()))
        {
            Assert.Equal(3, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal("NEEDS_INFORMATION",
                body.RootElement.GetProperty("overallStatus").GetString());
            Assert.Equal("ساعات پاسخگویی باید دقیق‌تر ثبت شود.",
                body.RootElement.GetProperty("reviewReason").GetString());
            Assert.False(body.RootElement
                .GetProperty("sellerPanelEnabled").GetBoolean());
        }

        var reopen = await applicant.PostAsJsonAsync(
            "/api/v1/seller/registration/reopen",
            new { revision = 3 });
        Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);
        using (var body = JsonDocument.Parse(
            await reopen.Content.ReadAsStringAsync()))
        {
            Assert.Equal("REWORK",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(4, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal("HNA-1234567890ABCDEF",
                body.RootElement.GetProperty("trackingCode").GetString());
        }

        // Identity/applicant type stays locked during correction mode.
        var identityChange = await applicant.PutAsJsonAsync(
            "/api/v1/seller/registration/applicant-type",
            new { applicantType = "LEGAL", revision = 4 });
        Assert.Equal(HttpStatusCode.Conflict, identityChange.StatusCode);

        var correction = await applicant.PutAsJsonAsync(
            "/api/v1/seller/registration/additional-information",
            new
            {
                contactName = "مسئول ثبت",
                contactRole = "مدیر فروش",
                backupPhone = "09123456780",
                websiteOrSocial = "example.com/hana",
                businessEmail = "seller@example.com",
                responseHours = "شنبه تا پنجشنبه، ۹ تا ۲۰",
                revision = 4
            });
        Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        using (var body = JsonDocument.Parse(
            await correction.Content.ReadAsStringAsync()))
        {
            Assert.Equal("REWORK",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(5, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal(6,
                body.RootElement.GetProperty("completedStep").GetInt32());
        }

        var resubmitKey = Guid.NewGuid();
        using var resubmit = new HttpRequestMessage(
            HttpMethod.Post, "/api/v1/seller/registration/submit")
        {
            Content = JsonContent.Create(new
            {
                revision = 5,
                confirmed = true
            })
        };
        resubmit.Headers.Add("Idempotency-Key", resubmitKey.ToString());
        var resubmitted = await applicant.SendAsync(resubmit);
        Assert.Equal(HttpStatusCode.OK, resubmitted.StatusCode);
        using (var body = JsonDocument.Parse(
            await resubmitted.Content.ReadAsStringAsync()))
        {
            Assert.Equal("SUBMITTED",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(6, body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal("HNA-1234567890ABCDEF",
                body.RootElement.GetProperty("trackingCode").GetString());
            Assert.Equal("UNDER_REVIEW",
                body.RootElement.GetProperty("reviewStatus").GetString());
        }

        var afterResubmit = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == applicantId);
        Assert.Equal("SUBMITTED", afterResubmit.Status);
        Assert.Equal("UNDER_REVIEW", afterResubmit.ReviewStatus);
        Assert.Null(afterResubmit.ReviewReason);
        Assert.Null(afterResubmit.ReviewedByAccountId);
        Assert.Null(afterResubmit.ReviewedAtUtc);
        Assert.Equal("شنبه تا پنجشنبه، ۹ تا ۲۰", afterResubmit.ResponseHours);
        Assert.Equal("0084575948", afterResubmit.NaturalNationalCode);

        var approvedKey = Guid.NewGuid();
        var approved = await Review(
            approvedKey,
            revision: 6,
            decision: "APPROVED",
            reason: null);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        using (var body = JsonDocument.Parse(
            await approved.Content.ReadAsStringAsync()))
        {
            Assert.Equal("APPROVED",
                body.RootElement.GetProperty("reviewStatus").GetString());
            Assert.Equal(7, body.RootElement.GetProperty("revision").GetInt32());
            Assert.False(body.RootElement
                .GetProperty("sellerActivated").GetBoolean());
        }

        var audits = await seller.ApplicationReviews.AsNoTracking()
            .Where(x => x.ApplicationAccountId == applicantId)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync();
        Assert.Equal(2, audits.Count);
        Assert.Equal("NEEDS_INFORMATION", audits[0].Decision);
        Assert.Equal("APPROVED", audits[1].Decision);
        Assert.Equal(needsInfoKey, audits[0].DecisionKey);
        Assert.Equal(approvedKey, audits[1].DecisionKey);
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
