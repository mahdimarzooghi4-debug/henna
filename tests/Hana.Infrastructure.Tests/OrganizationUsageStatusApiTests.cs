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

public sealed class OrganizationUsageStatusApiTests
{
    [Fact]
    public async Task UsageStatusFailsClosedWithoutFinancialUsageModel()
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
        var organizationId = Guid.NewGuid();
        var programId = Guid.NewGuid();
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
            Account(outsiderId, NewPhone(), now));
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

        organizations.Organizations.Add(new OrganizationRecord
        {
            Id = organizationId,
            Name = "سازمان وضعیت مصرف واقعی",
            OrganizationType = "سازمان حمایتگر",
            DefaultAllocationMethod = "الگوی حنا",
            IsActive = true,
            VerifiedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
        organizations.Memberships.Add(new OrganizationMembershipRecord
        {
            OrganizationId = organizationId,
            AccountId = viewerId,
            Role = "PORTAL_VIEWER",
            IsActive = true,
            CreatedAtUtc = now
        });
        organizations.Programs.Add(new OrganizationProgramRecord
        {
            Id = programId,
            OrganizationId = organizationId,
            Name = "طرحی که نباید به مصرف تبدیل شود",
            Kind = "اعتبار رفاهی",
            AllocationMethod = "الگوی حنا",
            BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
            Status = OrganizationProgramStates.Active,
            Revision = 2,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
        organizations.Recipients.Add(new OrganizationRecipientRecord
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            ProgramId = programId,
            DisplayName = "مشمولی که نباید وضعیت مصرف جعلی بگیرد",
            ReferenceMasked = "***REAL",
            Source = OrganizationRecipientSources.Manual,
            MatchStatus = OrganizationRecipientMatchStates.Matched,
            MatchedAccountId = viewerId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
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

        const string url = "/api/v1/organization/usage/status";

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

        var summary = root.GetProperty("summary");
        Assert.False(summary.GetProperty("available").GetBoolean());
        foreach (var property in new[]
        {
            "totalAllocated",
            "activeInUse",
            "consumed",
            "idleOrUnused"
        })
            Assert.Equal(
                JsonValueKind.Null,
                summary.GetProperty(property).ValueKind);

        var beneficiaryUsage = root.GetProperty("beneficiaryUsage");
        Assert.False(
            beneficiaryUsage.GetProperty("available").GetBoolean());
        Assert.Empty(
            beneficiaryUsage.GetProperty("items").EnumerateArray());

        var capability = root.GetProperty("capability");
        Assert.Equal(
            "NOT_CONFIGURED",
            capability.GetProperty("state").GetString());
        Assert.False(
            capability.GetProperty(
                "monetaryUsageReadModelAvailable").GetBoolean());
        Assert.False(
            capability.GetProperty("ledgerAvailable").GetBoolean());

        Assert.DoesNotContain(organizationId.ToString(), text);
        Assert.DoesNotContain(programId.ToString(), text);
        Assert.DoesNotContain(viewerId.ToString(), text);
        Assert.DoesNotContain(
            "طرحی که نباید به مصرف تبدیل شود",
            text);
        Assert.DoesNotContain(
            "مشمولی که نباید وضعیت مصرف جعلی بگیرد",
            text);
        Assert.DoesNotContain("***REAL", text);

        foreach (var forbidden in new[]
        {
            "\"amount\"",
            "\"amountIrr\"",
            "\"balance\"",
            "\"fundingSource\"",
            "\"ledgerEntries\"",
            "\"allocationId\"",
            "\"recipientId\"",
            "\"matchedAccountId\"",
            "\"phone\""
        })
            Assert.DoesNotContain(
                forbidden,
                text,
                StringComparison.OrdinalIgnoreCase);
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

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
