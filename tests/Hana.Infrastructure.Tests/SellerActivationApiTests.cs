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

public sealed class SellerActivationApiTests
{
    [Fact]
    public async Task ApprovedApplicationActivationGrantsSellerRoleAtomically()
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

        await using var identity =
            new HanaIdentityDbContext(identityOptions);
        await using var seller =
            new HanaSellerDbContext(sellerOptions);
        Assert.Empty(
            await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(
            await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var adminId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var pendingId = Guid.NewGuid();
        var openAmendmentId = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var applicantToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            applicantToken, out var applicantDigest));

        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(applicantId, NewPhone(), now),
            Account(pendingId, NewPhone(), now),
            Account(openAmendmentId, NewPhone(), now));
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

        var categoryId = Guid.NewGuid();
        seller.BusinessCategories.Add(new SellerBusinessCategoryRecord
        {
            Id = categoryId,
            Name = "فعال‌سازی " + Guid.NewGuid().ToString("N")[..8],
            IsActive = true,
            UpdatedAtUtc = now
        });
        seller.RegistrationDrafts.AddRange(
            Submitted(
                applicantId, categoryId, "APPROVED",
                "HNA-1111222233334444", now),
            Submitted(
                pendingId, categoryId, "UNDER_REVIEW",
                "HNA-AAAABBBBCCCCDDDD", now),
            Submitted(
                openAmendmentId, categoryId, "APPROVED",
                "HNA-5555666677778888", now));
        seller.ApplicationAmendments.Add(
            new SellerApplicationAmendmentRecord
            {
                Id = Guid.NewGuid(),
                ApplicationAccountId = openAmendmentId,
                BaseRevision = 5,
                Status = "OPEN",
                ReviewerReason = "اطلاعات بیشتری لازم است.",
                ResponseText = "در حال تکمیل.",
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        await seller.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var admin = factory.CreateClient();
        using var applicant = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue(
                "Bearer", adminToken);
        applicant.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue(
                "Bearer", applicantToken);

        Assert.False(await identity.RoleAssignments.AsNoTracking()
            .AnyAsync(x =>
                x.AccountId == applicantId &&
                x.Role == HanaRoles.Seller));
        Assert.Equal(HttpStatusCode.Forbidden,
            (await applicant.GetAsync(
                "/api/v1/seller/access")).StatusCode);

        var pendingUrl =
            "/api/v1/admin/seller-applications/" +
            pendingId + "/activate";
        using (var pendingRequest =
            new HttpRequestMessage(HttpMethod.Post, pendingUrl)
            {
                Content = JsonContent.Create(new { revision = 5 })
            })
        {
            pendingRequest.Headers.Add(
                "Idempotency-Key", Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(pendingRequest)).StatusCode);
        }

        var amendmentActivationUrl =
            "/api/v1/admin/seller-applications/" +
            openAmendmentId + "/activate";
        using (var openAmendment = new HttpRequestMessage(
            HttpMethod.Post, amendmentActivationUrl)
        {
            Content = JsonContent.Create(new { revision = 5 })
        })
        {
            openAmendment.Headers.Add(
                "Idempotency-Key", Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(openAmendment)).StatusCode);
        }

        var activationUrl =
            "/api/v1/admin/seller-applications/" +
            applicantId + "/activate";

        using (var forbidden =
            new HttpRequestMessage(HttpMethod.Post, activationUrl)
            {
                Content = JsonContent.Create(new { revision = 5 })
            })
        {
            forbidden.Headers.Add(
                "Idempotency-Key", Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Forbidden,
                (await applicant.SendAsync(forbidden)).StatusCode);
        }

        var staleKey = Guid.NewGuid();
        using (var stale =
            new HttpRequestMessage(HttpMethod.Post, activationUrl)
            {
                Content = JsonContent.Create(new { revision = 4 })
            })
        {
            stale.Headers.Add(
                "Idempotency-Key", staleKey.ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(stale)).StatusCode);
        }

        var preActivationStatus = await applicant.GetAsync(
            "/api/v1/seller/registration/status");
        Assert.Equal(HttpStatusCode.OK, preActivationStatus.StatusCode);
        using (var body = JsonDocument.Parse(
            await preActivationStatus.Content.ReadAsStringAsync()))
        {
            Assert.False(body.RootElement.GetProperty(
                "sellerAccessEnabled").GetBoolean());
            Assert.False(body.RootElement.GetProperty(
                "sellerPanelEnabled").GetBoolean());
            Assert.Equal("APPROVED", body.RootElement.GetProperty(
                "overallStatus").GetString());
        }

        var activationKey = Guid.NewGuid();
        async Task<HttpResponseMessage> Activate(Guid key)
        {
            using var request =
                new HttpRequestMessage(HttpMethod.Post, activationUrl)
                {
                    Content = JsonContent.Create(
                        new { revision = 5 })
                };
            request.Headers.Add(
                "Idempotency-Key", key.ToString());
            return await admin.SendAsync(request);
        }

        var activatedResponse = await Activate(activationKey);
        Assert.Equal(HttpStatusCode.OK,
            activatedResponse.StatusCode);
        using (var body = JsonDocument.Parse(
            await activatedResponse.Content.ReadAsStringAsync()))
        {
            Assert.Equal(6,
                body.RootElement.GetProperty(
                    "revision").GetInt32());
            Assert.Equal("APPROVED",
                body.RootElement.GetProperty(
                    "reviewStatus").GetString());
            Assert.True(body.RootElement.GetProperty(
                "sellerRoleGranted").GetBoolean());
            Assert.True(body.RootElement.GetProperty(
                "sellerAccessEnabled").GetBoolean());
            Assert.False(body.RootElement.GetProperty(
                "sellerPanelEnabled").GetBoolean());
            Assert.True(body.RootElement.TryGetProperty(
                "activatedAtUtc", out var activatedAt));
            Assert.NotEqual(JsonValueKind.Null,
                activatedAt.ValueKind);
        }

        seller.ChangeTracker.Clear();
        identity.ChangeTracker.Clear();

        var activated = await seller.RegistrationDrafts
            .AsNoTracking()
            .SingleAsync(x => x.AccountId == applicantId);
        Assert.Equal("APPROVED", activated.ReviewStatus);
        Assert.NotNull(activated.ActivatedAtUtc);
        Assert.Equal(adminId, activated.ActivatedByAccountId);
        Assert.Equal(6, activated.Revision);

        Assert.True(await identity.RoleAssignments.AsNoTracking()
            .AnyAsync(x =>
                x.AccountId == applicantId &&
                x.Role == HanaRoles.Seller));

        var audit = Assert.Single(
            await seller.SellerActivations.AsNoTracking()
                .Where(x =>
                    x.ApplicationAccountId == applicantId)
                .ToListAsync());
        Assert.Equal(activationKey, audit.ActivationKey);
        Assert.Equal(adminId, audit.ActivatedByAccountId);
        Assert.Equal(5, audit.ExpectedRevision);

        // Lost-response retry is idempotent.
        Assert.Equal(HttpStatusCode.OK,
            (await Activate(activationKey)).StatusCode);

        using (var second =
            new HttpRequestMessage(HttpMethod.Post, activationUrl)
            {
                Content = JsonContent.Create(new { revision = 6 })
            })
        {
            second.Headers.Add(
                "Idempotency-Key", Guid.NewGuid().ToString());
            Assert.Equal(HttpStatusCode.Conflict,
                (await admin.SendAsync(second)).StatusCode);
        }

        var access = await applicant.GetAsync(
            "/api/v1/seller/access");
        Assert.Equal(HttpStatusCode.OK, access.StatusCode);
        using (var body = JsonDocument.Parse(
            await access.Content.ReadAsStringAsync()))
        {
            Assert.True(body.RootElement.GetProperty(
                "sellerAccess").GetBoolean());
            Assert.Equal("HNA-1111222233334444",
                body.RootElement.GetProperty(
                    "trackingCode").GetString());
        }

        var status = await applicant.GetAsync(
            "/api/v1/seller/registration/status");
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        using (var body = JsonDocument.Parse(
            await status.Content.ReadAsStringAsync()))
        {
            Assert.Equal("APPROVED",
                body.RootElement.GetProperty(
                    "overallStatus").GetString());
            Assert.True(body.RootElement.GetProperty(
                "sellerAccessEnabled").GetBoolean());
            Assert.False(body.RootElement.GetProperty(
                "sellerPanelEnabled").GetBoolean());
            Assert.NotEqual(JsonValueKind.Null,
                body.RootElement.GetProperty(
                    "activatedAtUtc").ValueKind);
        }
    }

    private static SellerRegistrationDraft Submitted(
        Guid accountId,
        Guid categoryId,
        string reviewStatus,
        string trackingCode,
        DateTimeOffset now) => new()
    {
        AccountId = accountId,
        StoreName = "فروشگاه فعال‌سازی",
        OwnerName = "مسئول فعال‌سازی",
        Phone = "09123456789",
        City = "تهران",
        Address = "نشانی فعال‌سازی",
        PostalCode = "1234567890",
        ApplicantType = "NATURAL",
        NaturalNationalCode = "0084575948",
        IdentityStatus = "VERIFIED",
        BusinessCategoryId = categoryId,
        BusinessName = "کسب‌وکار فعال‌سازی",
        BusinessDescription = "توضیح کسب‌وکار فعال‌سازی",
        BusinessPhone = "02112345678",
        OfferingType = "GOOD",
        ActivityProvinceId = Guid.NewGuid(),
        ActivityCityId = Guid.NewGuid(),
        ActivityAddress = "نشانی فعالیت",
        ActivityHours = "۸ تا ۲۲",
        SellerDelivery = true,
        Pickup = true,
        ServiceArea = "کل شهر",
        RegistrationContactName = "مسئول ثبت",
        ResponseHours = "۸ تا ۲۲",
        CompletedStep = 6,
        Status = "SUBMITTED",
        Revision = 5,
        SubmissionKey = Guid.NewGuid(),
        SubmissionExpectedRevision = 4,
        SubmittedAtUtc = now.AddMinutes(-20),
        AccuracyConfirmedAtUtc = now.AddMinutes(-20),
        TrackingCode = trackingCode,
        ReviewStatus = reviewStatus,
        ReviewReason = null,
        ReviewedByAccountId = reviewStatus == "UNDER_REVIEW"
            ? null
            : Guid.NewGuid(),
        ReviewedAtUtc = reviewStatus == "UNDER_REVIEW"
            ? null
            : now.AddMinutes(-5),
        UpdatedAtUtc = now.AddMinutes(-5)
    };

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
        "09" + RandomNumberGenerator.GetInt32(
            1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
