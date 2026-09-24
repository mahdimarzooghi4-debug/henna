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

public sealed class OrganizationProgramApiTests
{
    [Fact]
    public async Task ProgramsAreReadOnlyAndStrictlyScopedToCurrentOrganization()
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
        var memberId = Guid.NewGuid();
        var outsiderId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var firstOrg = Guid.NewGuid();
        var secondOrg = Guid.NewGuid();
        var ownActive = Guid.NewGuid();
        var ownDraft = Guid.NewGuid();
        var ownEnded = Guid.NewGuid();
        var foreignProgram = Guid.NewGuid();

        var memberToken = SessionTokenCodec.Generate();
        var outsiderToken = SessionTokenCodec.Generate();
        var otherToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            memberToken, out var memberDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            outsiderToken, out var outsiderDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            otherToken, out var otherDigest));

        identity.Accounts.AddRange(
            Account(memberId, NewPhone(), now),
            Account(outsiderId, NewPhone(), now),
            Account(otherMemberId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(memberId, memberDigest, now),
            Session(outsiderId, outsiderDigest, now),
            Session(otherMemberId, otherDigest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(firstOrg, "سازمان اول CI", now),
            Organization(secondOrg, "سازمان دوم CI", now));
        organizations.Memberships.AddRange(
            Membership(firstOrg, memberId, now),
            Membership(secondOrg, otherMemberId, now));
        organizations.Programs.AddRange(
            Program(ownActive, firstOrg, "طرح فعال سازمان اول",
                OrganizationProgramStates.Active, now.AddMinutes(-3)),
            Program(ownDraft, firstOrg, "طرح پیش‌نویس سازمان اول",
                OrganizationProgramStates.Draft, now.AddMinutes(-2)),
            Program(ownEnded, firstOrg, "طرح پایان‌یافته سازمان اول",
                OrganizationProgramStates.Ended, now.AddMinutes(-1)),
            Program(foreignProgram, secondOrg, "طرح محرمانه سازمان دوم",
                OrganizationProgramStates.Active, now));
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var member = factory.CreateClient();
        using var outsider = factory.CreateClient();
        using var other = factory.CreateClient();
        member.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", memberToken);
        outsider.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", outsiderToken);
        other.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", otherToken);

        const string url = "/api/v1/organization/programs";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await outsider.GetAsync(url)).StatusCode);

        var list = await member.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal("no-store",
            list.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(
            await list.Content.ReadAsStringAsync()))
        {
            var root = body.RootElement;
            Assert.Equal(3, root.GetProperty("total").GetInt32());
            Assert.Equal(1, root.GetProperty("page").GetInt32());
            Assert.Equal(20, root.GetProperty("pageSize").GetInt32());
            var items = root.GetProperty("items").EnumerateArray().ToArray();
            Assert.Equal(3, items.Length);
            Assert.DoesNotContain(items,
                x => x.GetProperty("id").GetGuid() == foreignProgram);
            Assert.All(items,
                x => Assert.False(
                    x.TryGetProperty("organizationId", out _)));
        }

        var filtered = await member.GetAsync(url + "?status=active");
        Assert.Equal(HttpStatusCode.OK, filtered.StatusCode);
        using (var body = JsonDocument.Parse(
            await filtered.Content.ReadAsStringAsync()))
        {
            Assert.Equal(1, body.RootElement.GetProperty("total").GetInt32());
            Assert.Equal(ownActive, body.RootElement
                .GetProperty("items")[0].GetProperty("id").GetGuid());
        }

        var paged = await member.GetAsync(url + "?page=2&pageSize=1");
        Assert.Equal(HttpStatusCode.OK, paged.StatusCode);
        using (var body = JsonDocument.Parse(
            await paged.Content.ReadAsStringAsync()))
        {
            Assert.Equal(3, body.RootElement.GetProperty("total").GetInt32());
            Assert.Single(body.RootElement.GetProperty("items")
                .EnumerateArray());
        }

        foreach (var invalid in new[]
        {
            "?page=0",
            "?pageSize=51",
            "?status=unknown",
            "?organizationId=" + secondOrg,
            "?extra=1"
        })
            Assert.Equal(HttpStatusCode.BadRequest,
                (await member.GetAsync(url + invalid)).StatusCode);

        var detail = await member.GetAsync(url + "/" + ownDraft);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        using (var body = JsonDocument.Parse(
            await detail.Content.ReadAsStringAsync()))
        {
            Assert.Equal("طرح پیش‌نویس سازمان اول",
                body.RootElement.GetProperty("name").GetString());
            Assert.Equal("الگوی حنا",
                body.RootElement.GetProperty("allocationMethod").GetString());
            Assert.Equal("API_OR_MANUAL",
                body.RootElement.GetProperty("beneficiarySource").GetString());
            Assert.False(
                body.RootElement.TryGetProperty("organizationId", out _));
        }

        Assert.Equal(HttpStatusCode.NotFound,
            (await member.GetAsync(url + "/" + foreignProgram)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await other.GetAsync(url + "/" + foreignProgram)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(url + "/" + ownActive + "?x=1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await member.GetAsync(url + "/" + Guid.NewGuid())).StatusCode);

        await identity.AuthSessions
            .Where(x => x.AccountId == memberId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                x => x.RevokedAtUtc, DateTimeOffset.UtcNow));
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await member.GetAsync(url)).StatusCode);
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

    private static OrganizationRecord Organization(
        Guid id, string name, DateTimeOffset now) => new()
    {
        Id = id,
        Name = name,
        OrganizationType = "سازمان حمایتگر",
        DefaultAllocationMethod = "الگوی حنا",
        IsActive = true,
        VerifiedAtUtc = now,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static OrganizationMembershipRecord Membership(
        Guid organizationId, Guid accountId, DateTimeOffset now) => new()
    {
        OrganizationId = organizationId,
        AccountId = accountId,
        Role = "PORTAL_ADMIN",
        IsActive = true,
        CreatedAtUtc = now
    };

    private static OrganizationProgramRecord Program(
        Guid id, Guid organizationId, string name,
        string status, DateTimeOffset created) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار نمونه",
        AllocationMethod = "الگوی حنا",
        BeneficiarySource = "API_OR_MANUAL",
        Description = "داده صرفاً تست CI",
        Status = status,
        Revision = 1,
        CreatedAtUtc = created,
        UpdatedAtUtc = created
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
