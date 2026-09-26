using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationPortalApiTests
{
    [Fact]
    public async Task OrganizationProvisioningIsAdminOnlyAndProfilesAreMembershipScoped()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        var now = DateTimeOffset.UtcNow;
        var adminId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var unrelatedId = Guid.NewGuid();
        var adminToken = SessionTokenCodec.Generate();
        var memberToken = SessionTokenCodec.Generate();
        var unrelatedToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(adminToken, out var adminHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(memberToken, out var memberHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(unrelatedToken, out var unrelatedHash));
        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options;
        var organizationOptions = new DbContextOptionsBuilder<HanaOrganizationDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "organization")).Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var organizations = new HanaOrganizationDbContext(organizationOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await organizations.Database.GetPendingMigrationsAsync());
        identity.Accounts.AddRange(Account(adminId, now), Account(memberId, now), Account(unrelatedId, now));
        identity.AuthSessions.AddRange(Session(adminId, adminHash, now), Session(memberId, memberHash, now), Session(unrelatedId, unrelatedHash, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord { AccountId = adminId, Role = HanaRoles.Admin, GrantedAtUtc = now });
        await identity.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var admin = factory.CreateClient();
        using var member = factory.CreateClient();
        using var unrelated = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        member.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        unrelated.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", unrelatedToken);

        const string profileUrl = "/api/v1/organization/profiles";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(profileUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.PostAsJsonAsync("/api/v1/admin/organizations", new { name = "داده سازمان تست", initialAccountId = memberId, role = OrganizationRoles.Representative })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.GetAsync(profileUrl)).StatusCode);

        var key = Guid.NewGuid();
        admin.DefaultRequestHeaders.Add("Idempotency-Key", key.ToString());
        var request = new { name = "سازمان آزمایش", initialAccountId = memberId, role = OrganizationRoles.Representative };
        var created = await admin.PostAsJsonAsync("/api/v1/admin/organizations", request);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var replay = await admin.PostAsJsonAsync("/api/v1/admin/organizations", request);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using var createdBody = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        using var replayBody = JsonDocument.Parse(await replay.Content.ReadAsStringAsync());
        var orgId = createdBody.RootElement.GetProperty("organizationId").GetGuid();
        Assert.Equal(orgId, replayBody.RootElement.GetProperty("organizationId").GetGuid());

        var response = await member.GetAsync(profileUrl);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.GetValues("Cache-Control").Single());
        using var profile = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = profile.RootElement.GetProperty("profiles").EnumerateArray().ToArray();
        var own = Assert.Single(items);
        Assert.Equal(orgId, own.GetProperty("organizationId").GetGuid());
        Assert.Equal(OrganizationRoles.Representative, own.GetProperty("memberRole").GetString());

        Assert.False(await identity.RoleAssignments.AnyAsync(x => x.AccountId == memberId));
        var membership = await organizations.Memberships.SingleAsync(x => x.OrganizationId == orgId && x.AccountId == memberId);
        Assert.Null(membership.RevokedAtUtc);

        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        var grantKey = Guid.NewGuid();
        admin.DefaultRequestHeaders.Add("Idempotency-Key", grantKey.ToString());
        var granted = await admin.PostAsJsonAsync($"/api/v1/admin/organizations/{orgId}/memberships", new { accountId = unrelatedId, role = OrganizationRoles.TechnicalOperator });
        Assert.Equal(HttpStatusCode.Created, granted.StatusCode);
        var grantReplay = await admin.PostAsJsonAsync($"/api/v1/admin/organizations/{orgId}/memberships", new { accountId = unrelatedId, role = OrganizationRoles.TechnicalOperator });
        Assert.Equal(HttpStatusCode.OK, grantReplay.StatusCode);
        using var grantedBody = JsonDocument.Parse(await granted.Content.ReadAsStringAsync());
        var membershipId = grantedBody.RootElement.GetProperty("membershipId").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await unrelated.GetAsync(profileUrl)).StatusCode);

        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        var revokeKey = Guid.NewGuid();
        admin.DefaultRequestHeaders.Add("Idempotency-Key", revokeKey.ToString());
        var revokeRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/admin/organizations/{orgId}/memberships/{membershipId}?revision=1");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(revokeRequest)).StatusCode);
        var revokeRetry = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/admin/organizations/{orgId}/memberships/{membershipId}?revision=1");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(revokeRetry)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.GetAsync(profileUrl)).StatusCode);
        var revoked = await organizations.Memberships.SingleAsync(x => x.Id == membershipId);
        Assert.Equal(adminId, revoked.RevokedByAccountId);
        Assert.Equal(revokeKey, revoked.RevokeKey);
    }

    private static AccountRecord Account(Guid id, DateTimeOffset now) => new()
    { Id = id, NormalizedPhone = "09" + RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9", CultureInfo.InvariantCulture), CreatedAtUtc = now, PhoneVerifiedAtUtc = now };
    private static AuthSessionRecord Session(Guid accountId, byte[] digest, DateTimeOffset now) => new()
    { Id = Guid.NewGuid(), AccountId = accountId, TokenDigest = digest, IssuedAtUtc = now.AddMinutes(-1), ExpiresAtUtc = now.AddHours(1) };
}
