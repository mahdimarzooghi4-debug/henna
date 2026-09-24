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

public sealed class OrganizationProfileApiTests
{
    [Fact]
    public async Task ProfileRequiresRealSessionAndExplicitActiveMembership()
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
        var memberAccountId = Guid.NewGuid();
        var outsiderAccountId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        var memberToken = SessionTokenCodec.Generate();
        var outsiderToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            memberToken, out var memberDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            outsiderToken, out var outsiderDigest));

        identity.Accounts.AddRange(
            new AccountRecord
            {
                Id = memberAccountId, NormalizedPhone = NewPhone(),
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            },
            new AccountRecord
            {
                Id = outsiderAccountId, NormalizedPhone = NewPhone(),
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now
            });
        identity.AuthSessions.AddRange(
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = memberAccountId,
                TokenDigest = memberDigest, IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            },
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(), AccountId = outsiderAccountId,
                TokenDigest = outsiderDigest, IssuedAtUtc = now.AddMinutes(-1),
                ExpiresAtUtc = now.AddHours(1)
            });
        await identity.SaveChangesAsync();

        organizations.Organizations.Add(new OrganizationRecord
        {
            Id = organizationId,
            Name = "سازمان تست ایزوله",
            OrganizationType = "سازمان حمایتگر",
            DefaultAllocationMethod = "الگوی حنا",
            Phone = "02100000000",
            Email = "org-ci@example.test",
            Address = "نشانی صرفاً تست CI",
            RepresentativeName = "نماینده تست",
            RepresentativePhone = "09120000000",
            VerifiedAtUtc = now,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
        organizations.Memberships.Add(new OrganizationMembershipRecord
        {
            OrganizationId = organizationId,
            AccountId = memberAccountId,
            Role = "PORTAL_ADMIN",
            IsActive = true,
            CreatedAtUtc = now
        });
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var anonymous = factory.CreateClient();
        using var member = factory.CreateClient();
        using var outsider = factory.CreateClient();
        member.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", memberToken);
        outsider.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", outsiderToken);

        const string url = "/api/v1/organization/me";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await outsider.GetAsync(url)).StatusCode);

        var response = await member.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store",
            response.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync()))
        {
            Assert.Equal("سازمان تست ایزوله",
                body.RootElement.GetProperty("name").GetString());
            Assert.Equal("سازمان حمایتگر",
                body.RootElement.GetProperty("organizationType").GetString());
            Assert.Equal("الگوی حنا",
                body.RootElement.GetProperty("defaultAllocationMethod").GetString());
            Assert.Equal("PORTAL_ADMIN",
                body.RootElement.GetProperty("memberRole").GetString());
            Assert.True(body.RootElement.GetProperty("verified").GetBoolean());
            Assert.True(body.RootElement.GetProperty("active").GetBoolean());
            Assert.False(body.RootElement.TryGetProperty("accountId", out _));
        }

        var membership = await organizations.Memberships
            .SingleAsync(x => x.OrganizationId == organizationId &&
                              x.AccountId == memberAccountId);
        membership.IsActive = false;
        await organizations.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await member.GetAsync(url)).StatusCode);

        membership.IsActive = true;
        await organizations.SaveChangesAsync();
        await identity.AuthSessions
            .Where(x => x.AccountId == memberAccountId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                x => x.RevokedAtUtc, DateTimeOffset.UtcNow));
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await member.GetAsync(url)).StatusCode);
    }

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
