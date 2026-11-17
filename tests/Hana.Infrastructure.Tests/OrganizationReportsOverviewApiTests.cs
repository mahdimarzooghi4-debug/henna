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

public sealed class OrganizationReportsOverviewApiTests
{
    [Fact]
    public async Task ReportUsesRealEnrollmentMatchingAndKeepsFinanceUnavailable()
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
        var foreignAccountId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        var foreignOrganizationId = Guid.NewGuid();
        var registeredProgramId = Guid.NewGuid();
        var activeProgramId = Guid.NewGuid();
        var draftProgramId = Guid.NewGuid();
        var foreignProgramId = Guid.NewGuid();

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
            Account(foreignAccountId, NewPhone(), now));
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
                organizationId,
                "سازمان گزارش واقعی",
                "سازمان حمایتگر",
                now),
            Organization(
                foreignOrganizationId,
                "سازمان گزارش خارجی",
                "سازمان معمولی",
                now));
        organizations.Memberships.Add(
            Membership(organizationId, viewerId, now));

        organizations.Programs.AddRange(
            Program(
                registeredProgramId,
                organizationId,
                "طرح ثبت‌شده گزارش",
                OrganizationProgramStates.Registered,
                now),
            Program(
                activeProgramId,
                organizationId,
                "طرح فعال گزارش",
                OrganizationProgramStates.Active,
                now),
            Program(
                draftProgramId,
                organizationId,
                "طرح پیش‌نویس خارج از گزارش",
                OrganizationProgramStates.Draft,
                now),
            Program(
                foreignProgramId,
                foreignOrganizationId,
                "طرح سازمان دیگر",
                OrganizationProgramStates.Active,
                now));

        organizations.Recipients.AddRange(
            Recipient(
                organizationId,
                registeredProgramId,
                "matched 1",
                "REP****001",
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now),
            Recipient(
                organizationId,
                registeredProgramId,
                "needs",
                "REP****002",
                OrganizationRecipientMatchStates.NeedsMatch,
                null,
                now),
            Recipient(
                organizationId,
                registeredProgramId,
                "review",
                "REP****003",
                OrganizationRecipientMatchStates.PendingReview,
                null,
                now),
            Recipient(
                organizationId,
                activeProgramId,
                "matched 2",
                "REP****004",
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now),
            Recipient(
                organizationId,
                draftProgramId,
                "draft must not count",
                "REP****005",
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now),
            Recipient(
                foreignOrganizationId,
                foreignProgramId,
                "foreign must not count",
                "FOR****001",
                OrganizationRecipientMatchStates.Matched,
                foreignAccountId,
                now));
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

        const string url = "/api/v1/organization/reports/overview";

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await outsider.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await revoked.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await viewer.GetAsync(
                url + "?organizationId=" + organizationId)).StatusCode);

        var response = await viewer.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            "no-store",
            response.Headers.GetValues("Cache-Control").Single());

        var text = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(text);
        var root = json.RootElement;

        Assert.Equal(
            "سازمان حمایتگر",
            root.GetProperty("organizationType").GetString());
        Assert.Equal(
            JsonValueKind.Null,
            root.GetProperty("lastRecordedSyncAtUtc").ValueKind);

        var matching = root.GetProperty("matching");
        Assert.True(matching.GetProperty("available").GetBoolean());
        Assert.Equal(
            "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS",
            matching.GetProperty("scope").GetString());
        Assert.Equal(
            2,
            matching.GetProperty("eligibleProgramCount").GetInt32());
        Assert.Equal(
            4,
            matching.GetProperty(
                "totalEnrollmentRecordCount").GetInt32());
        Assert.Equal(
            2,
            matching.GetProperty("matchedRecordCount").GetInt32());
        Assert.Equal(
            2,
            matching.GetProperty("needsReviewRecordCount").GetInt32());
        Assert.Equal(
            50m,
            matching.GetProperty("matchRatePercent").GetDecimal());

        var usage = root.GetProperty("usage");
        Assert.False(usage.GetProperty("available").GetBoolean());
        Assert.Equal(
            JsonValueKind.Null,
            usage.GetProperty("usedBudget").ValueKind);
        Assert.Equal(
            JsonValueKind.Null,
            usage.GetProperty("utilizationPercent").ValueKind);

        var trend = root.GetProperty("allocationDistributionTrend");
        Assert.False(trend.GetProperty("available").GetBoolean());
        Assert.Empty(trend.GetProperty("points").EnumerateArray());

        var capability = root.GetProperty("capability");
        Assert.False(
            capability.GetProperty(
                "financialReportingAvailable").GetBoolean());
        Assert.False(
            capability.GetProperty(
                "allocationDistributionTrendAvailable").GetBoolean());

        foreach (var secret in new[]
        {
            organizationId.ToString(),
            foreignOrganizationId.ToString(),
            registeredProgramId.ToString(),
            activeProgramId.ToString(),
            draftProgramId.ToString(),
            foreignProgramId.ToString(),
            viewerId.ToString(),
            matchedAccountId.ToString(),
            foreignAccountId.ToString(),
            "REP****001",
            "FOR****001",
            "طرح پیش‌نویس خارج از گزارش",
            "طرح سازمان دیگر"
        })
            Assert.DoesNotContain(secret, text);

        foreach (var forbidden in new[]
        {
            "\"amount\"",
            "\"amountIrr\"",
            "\"balance\"",
            "\"fundingSource\"",
            "\"ledger\"",
            "\"allocationId\"",
            "\"recipientId\""
        })
            Assert.DoesNotContain(
                forbidden,
                text,
                StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MatchRateIsNullWhenEligibleProgramsHaveNoRecipients()
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

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        var programId = Guid.NewGuid();
        var token = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            token, out var digest));

        identity.Accounts.Add(Account(accountId, NewPhone(), now));
        identity.AuthSessions.Add(Session(accountId, digest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.Add(
            Organization(
                organizationId,
                "سازمان گزارش بدون مشمول",
                "سازمان حمایتگر",
                now));
        organizations.Memberships.Add(
            Membership(organizationId, accountId, now));
        organizations.Programs.Add(
            Program(
                programId,
                organizationId,
                "طرح خالی",
                OrganizationProgramStates.Active,
                now));
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync(
            "/api/v1/organization/reports/overview");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var json = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        var matching = json.RootElement.GetProperty("matching");
        Assert.Equal(
            0,
            matching.GetProperty(
                "totalEnrollmentRecordCount").GetInt32());
        Assert.Equal(
            JsonValueKind.Null,
            matching.GetProperty("matchRatePercent").ValueKind);
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
        DateTimeOffset now) => new()
    {
        Id = id,
        Name = name,
        OrganizationType = type,
        DefaultAllocationMethod = "الگوی حنا",
        IsActive = true,
        VerifiedAtUtc = now,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static OrganizationMembershipRecord Membership(
        Guid organizationId,
        Guid accountId,
        DateTimeOffset now) => new()
    {
        OrganizationId = organizationId,
        AccountId = accountId,
        Role = "PORTAL_VIEWER",
        IsActive = true,
        CreatedAtUtc = now
    };

    private static OrganizationProgramRecord Program(
        Guid id,
        Guid organizationId,
        string name,
        string status,
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار رفاهی",
        AllocationMethod = "الگوی حنا",
        BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
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
        string matchStatus,
        Guid? matchedAccountId,
        DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = organizationId,
        ProgramId = programId,
        DisplayName = displayName,
        ReferenceMasked = maskedReference,
        Source = OrganizationRecipientSources.Manual,
        MatchStatus = matchStatus,
        MatchedAccountId = matchedAccountId,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
