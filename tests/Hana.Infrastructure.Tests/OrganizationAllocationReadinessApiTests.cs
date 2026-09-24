using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationAllocationReadinessApiTests
{
    [Fact]
    public async Task ReadinessIsTenantScopedNonMonetaryAndUsesOnlyEligiblePrograms()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var organizationOptions =
            new DbContextOptionsBuilder<HanaOrganizationDbContext>()
                .UseNpgsql(connection, pg => pg.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "organization")).Options;

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var organizations =
            new HanaOrganizationDbContext(organizationOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await organizations.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var viewerId = Guid.NewGuid();
        var outsiderId = Guid.NewGuid();
        var matchedAccountId = Guid.NewGuid();
        var foreignMatchedAccountId = Guid.NewGuid();
        var firstOrg = Guid.NewGuid();
        var secondOrg = Guid.NewGuid();
        var registeredProgram = Guid.NewGuid();
        var activeProgram = Guid.NewGuid();
        var draftProgram = Guid.NewGuid();
        var foreignProgram = Guid.NewGuid();

        var viewerToken = SessionTokenCodec.Generate();
        var outsiderToken = SessionTokenCodec.Generate();
        var revokedToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            viewerToken, out var viewerDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            outsiderToken, out var outsiderDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            revokedToken, out var revokedDigest));

        identity.Accounts.AddRange(
            Account(viewerId, NewPhone(), now),
            Account(outsiderId, NewPhone(), now),
            Account(matchedAccountId, NewPhone(), now),
            Account(foreignMatchedAccountId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(viewerId, viewerDigest, now),
            Session(outsiderId, outsiderDigest, now),
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(),
                AccountId = viewerId,
                TokenDigest = revokedDigest,
                IssuedAtUtc = now.AddHours(-2),
                ExpiresAtUtc = now.AddHours(1),
                RevokedAtUtc = now.AddMinutes(-1)
            });
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(
                firstOrg,
                "سازمان آمادگی تخصیص اول",
                "سازمان حمایتگر",
                "الگوی حنا",
                now),
            Organization(
                secondOrg,
                "سازمان آمادگی تخصیص دوم",
                "سازمان معمولی",
                "انتخاب توسط سازمان",
                now));
        organizations.Memberships.Add(
            Membership(
                firstOrg,
                viewerId,
                "PORTAL_VIEWER",
                now));
        organizations.Programs.AddRange(
            Program(
                registeredProgram,
                firstOrg,
                "طرح ثبت‌شده آمادگی",
                OrganizationProgramStates.Registered,
                "الگوی حنا",
                now.AddMinutes(-4)),
            Program(
                activeProgram,
                firstOrg,
                "طرح فعال آمادگی",
                OrganizationProgramStates.Active,
                "الگوی حنا",
                now.AddMinutes(-3)),
            Program(
                draftProgram,
                firstOrg,
                "طرح پیش‌نویس نباید شمرده شود",
                OrganizationProgramStates.Draft,
                "الگوی حنا",
                now.AddMinutes(-2)),
            Program(
                foreignProgram,
                secondOrg,
                "طرح محرمانه سازمان دوم",
                OrganizationProgramStates.Active,
                "انتخاب توسط سازمان",
                now.AddMinutes(-1)));

        organizations.Recipients.AddRange(
            Recipient(
                firstOrg,
                registeredProgram,
                "ثبت‌شده matched",
                "REG****001",
                OrganizationRecipientSources.Manual,
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now.AddMinutes(-10)),
            Recipient(
                firstOrg,
                registeredProgram,
                "ثبت‌شده needs",
                "REG****002",
                OrganizationRecipientSources.Api,
                OrganizationRecipientMatchStates.NeedsMatch,
                null,
                now.AddMinutes(-9)),
            Recipient(
                firstOrg,
                registeredProgram,
                "ثبت‌شده review",
                "REG****003",
                OrganizationRecipientSources.Manual,
                OrganizationRecipientMatchStates.PendingReview,
                null,
                now.AddMinutes(-8)),
            Recipient(
                firstOrg,
                activeProgram,
                "فعال matched",
                "ACT****001",
                OrganizationRecipientSources.Manual,
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now.AddMinutes(-7)),
            Recipient(
                firstOrg,
                draftProgram,
                "پیش‌نویس نباید شمرده شود",
                "DRA****001",
                OrganizationRecipientSources.Api,
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now.AddMinutes(-6)),
            Recipient(
                secondOrg,
                foreignProgram,
                "فرد سازمان دوم",
                "FOR****001",
                OrganizationRecipientSources.Api,
                OrganizationRecipientMatchStates.Matched,
                foreignMatchedAccountId,
                now.AddMinutes(-5)));
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var viewer = factory.CreateClient();
        using var outsider = factory.CreateClient();
        using var revoked = factory.CreateClient();

        viewer.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", viewerToken);
        outsider.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", outsiderToken);
        revoked.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", revokedToken);

        const string overviewUrl =
            "/api/v1/organization/allocation/readiness";

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(overviewUrl)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await outsider.GetAsync(overviewUrl)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await revoked.GetAsync(overviewUrl)).StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await viewer.GetAsync(
                overviewUrl + "?organizationId=" + firstOrg)).StatusCode);

        var overview = await viewer.GetAsync(overviewUrl);
        Assert.Equal(HttpStatusCode.OK, overview.StatusCode);
        Assert.Equal(
            "no-store",
            overview.Headers.GetValues("Cache-Control").Single());

        var overviewText = await overview.Content.ReadAsStringAsync();
        using (var body = JsonDocument.Parse(overviewText))
        {
            var root = body.RootElement;
            Assert.Equal(
                "سازمان حمایتگر",
                root.GetProperty("organizationType").GetString());
            Assert.Equal(
                "الگوی حنا",
                root.GetProperty("allocationMethod").GetString());
            Assert.Equal(JsonValueKind.Null,
                root.GetProperty("targetPeriod").ValueKind);
            Assert.Equal(2,
                root.GetProperty("eligibleProgramCount").GetInt32());
            Assert.Equal(4,
                root.GetProperty("inputRecordCount").GetInt32());
            Assert.Equal(2,
                root.GetProperty("readyRecordCount").GetInt32());
            Assert.Equal(2,
                root.GetProperty("needsReviewRecordCount").GetInt32());
            Assert.Equal(3,
                root.GetProperty("sources")
                    .GetProperty("manualRecordCount").GetInt32());
            Assert.Equal(1,
                root.GetProperty("sources")
                    .GetProperty("apiRecordCount").GetInt32());

            var execution = root.GetProperty("execution");
            Assert.False(execution.GetProperty("enabled").GetBoolean());
            Assert.Equal(
                "NOT_CONFIGURED",
                execution.GetProperty("state").GetString());
            Assert.False(execution.GetProperty(
                "monetaryMutationSupported").GetBoolean());

            var history = root.GetProperty("processHistory");
            Assert.False(history.GetProperty("available").GetBoolean());
            Assert.Empty(history.GetProperty("items").EnumerateArray());

            var programs = root.GetProperty("programs")
                .EnumerateArray()
                .ToArray();
            Assert.Equal(2, programs.Length);
            Assert.DoesNotContain(
                programs,
                x => x.GetProperty("id").GetGuid() == draftProgram);
            Assert.DoesNotContain(
                programs,
                x => x.GetProperty("id").GetGuid() == foreignProgram);

            var registered = programs.Single(
                x => x.GetProperty("id").GetGuid() ==
                    registeredProgram);
            Assert.Equal(3,
                registered.GetProperty("inputRecordCount").GetInt32());
            Assert.Equal(1,
                registered.GetProperty("readyRecordCount").GetInt32());
            Assert.Equal(2,
                registered.GetProperty(
                    "needsReviewRecordCount").GetInt32());

            var active = programs.Single(
                x => x.GetProperty("id").GetGuid() ==
                    activeProgram);
            Assert.Equal(1,
                active.GetProperty("inputRecordCount").GetInt32());
            Assert.Equal(1,
                active.GetProperty("readyRecordCount").GetInt32());
            Assert.Equal(0,
                active.GetProperty(
                    "needsReviewRecordCount").GetInt32());
        }

        Assert.DoesNotContain(firstOrg.ToString(), overviewText);
        Assert.DoesNotContain(secondOrg.ToString(), overviewText);
        Assert.DoesNotContain(matchedAccountId.ToString(), overviewText);
        Assert.DoesNotContain(
            "طرح پیش‌نویس نباید شمرده شود",
            overviewText);
        Assert.DoesNotContain(
            "طرح محرمانه سازمان دوم",
            overviewText);
        foreach (var forbidden in new[]
        {
            "\"amount\"",
            "\"balance\"",
            "\"ledger\"",
            "\"fundingSource\"",
            "\"allocationId\"",
            "\"beneficiaryAccountId\""
        })
            Assert.DoesNotContain(
                forbidden,
                overviewText,
                StringComparison.OrdinalIgnoreCase);

        var detail = await viewer.GetAsync(
            overviewUrl + "/" + registeredProgram);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        Assert.Equal(
            "no-store",
            detail.Headers.GetValues("Cache-Control").Single());
        var detailText = await detail.Content.ReadAsStringAsync();
        using (var body = JsonDocument.Parse(detailText))
        {
            var root = body.RootElement;
            var program = root.GetProperty("program");
            Assert.Equal(
                registeredProgram,
                program.GetProperty("id").GetGuid());
            Assert.Equal(
                "طرح ثبت‌شده آمادگی",
                program.GetProperty("name").GetString());
            Assert.Equal(3,
                program.GetProperty("inputRecordCount").GetInt32());
            Assert.Equal(1,
                program.GetProperty("readyRecordCount").GetInt32());
            Assert.Equal(2,
                program.GetProperty(
                    "needsReviewRecordCount").GetInt32());

            Assert.False(
                root.GetProperty("execution")
                    .GetProperty("enabled").GetBoolean());
            var result = root.GetProperty("result");
            Assert.False(
                result.GetProperty("available").GetBoolean());
            Assert.Equal(
                JsonValueKind.Null,
                result.GetProperty(
                    "allocatedRecordCount").ValueKind);
            Assert.Equal(2,
                result.GetProperty(
                    "needsReviewRecordCount").GetInt32());
        }

        Assert.DoesNotContain(matchedAccountId.ToString(), detailText);

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await viewer.GetAsync(
                overviewUrl + "/" + draftProgram)).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await viewer.GetAsync(
                overviewUrl + "/" + foreignProgram)).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await viewer.GetAsync(
                overviewUrl + "/" + Guid.NewGuid())).StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await viewer.GetAsync(
                overviewUrl + "/" + registeredProgram +
                "?extra=1")).StatusCode);
    }

    private static AccountRecord Account(
        Guid id,
        string phone,
        DateTimeOffset now) => new()
    {
        Id = id,
        NormalizedPhone = phone,
        CreatedAtUtc = now,
        PhoneVerifiedAtUtc = now
    };

    private static AuthSessionRecord Session(
        Guid accountId,
        byte[] digest,
        DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        TokenDigest = digest,
        IssuedAtUtc = now.AddMinutes(-1),
        ExpiresAtUtc = now.AddHours(1)
    };

    private static OrganizationRecord Organization(
        Guid id,
        string name,
        string type,
        string allocationMethod,
        DateTimeOffset now) => new()
    {
        Id = id,
        Name = name,
        OrganizationType = type,
        DefaultAllocationMethod = allocationMethod,
        IsActive = true,
        VerifiedAtUtc = now,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static OrganizationMembershipRecord Membership(
        Guid organizationId,
        Guid accountId,
        string role,
        DateTimeOffset now) => new()
    {
        OrganizationId = organizationId,
        AccountId = accountId,
        Role = role,
        IsActive = true,
        CreatedAtUtc = now
    };

    private static OrganizationProgramRecord Program(
        Guid id,
        Guid organizationId,
        string name,
        string status,
        string allocationMethod,
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار رفاهی",
        AllocationMethod = allocationMethod,
        BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
        Description = null,
        Status = status,
        Revision = status == OrganizationProgramStates.Draft ? 1 : 2,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static OrganizationRecipientRecord Recipient(
        Guid organizationId,
        Guid programId,
        string displayName,
        string maskedReference,
        string source,
        string matchStatus,
        Guid? matchedAccountId,
        DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = organizationId,
        ProgramId = programId,
        DisplayName = displayName,
        ReferenceMasked = maskedReference,
        Source = source,
        MatchStatus = matchStatus,
        MatchedAccountId = matchedAccountId,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
