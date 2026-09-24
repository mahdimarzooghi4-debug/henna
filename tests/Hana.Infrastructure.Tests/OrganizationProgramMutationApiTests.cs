using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationProgramMutationApiTests
{
    [Fact]
    public async Task AdminCreatesIdempotentDraftAndEditsWithRevisionGuard()
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
        var adminId = Guid.NewGuid();
        var viewerId = Guid.NewGuid();
        var otherAdminId = Guid.NewGuid();
        var firstOrg = Guid.NewGuid();
        var secondOrg = Guid.NewGuid();
        var foreignProgramId = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var viewerToken = SessionTokenCodec.Generate();
        var otherToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            viewerToken, out var viewerDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            otherToken, out var otherDigest));

        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(viewerId, NewPhone(), now),
            Account(otherAdminId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminDigest, now),
            Session(viewerId, viewerDigest, now),
            Session(otherAdminId, otherDigest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(firstOrg, "سازمان mutation اول", now),
            Organization(secondOrg, "سازمان mutation دوم", now));
        organizations.Memberships.AddRange(
            Membership(firstOrg, adminId,
                OrganizationProgramPermissions.PortalAdmin, now),
            Membership(firstOrg, viewerId, "PORTAL_VIEWER", now),
            Membership(secondOrg, otherAdminId,
                OrganizationProgramPermissions.PortalAdmin, now));
        organizations.Programs.Add(new OrganizationProgramRecord
        {
            Id = foreignProgramId,
            OrganizationId = secondOrg,
            Name = "طرح پیش‌نویس سازمان دوم",
            Kind = "اعتبار",
            AllocationMethod = "الگوی حنا",
            BeneficiarySource = OrganizationBeneficiarySources.Manual,
            Status = OrganizationProgramStates.Draft,
            Revision = 1,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var admin = factory.CreateClient();
        using var viewer = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", adminToken);
        viewer.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", viewerToken);

        const string url = "/api/v1/organization/programs";
        var payload =
            """{"name":"طرح رفاهی واقعی","kind":"اعتبار رفاهی","beneficiarySource":"API","description":"شرح اولیه"}""";

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await PostAsync(anonymous, url, Guid.NewGuid(), payload)).StatusCode);

        // Read access is broader than mutation access.
        Assert.Equal(HttpStatusCode.OK,
            (await viewer.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await PostAsync(viewer, url, Guid.NewGuid(), payload)).StatusCode);

        var missingKey = await admin.PostAsync(
            url, Json(payload));
        Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);

        var forbiddenField = await PostAsync(
            admin,
            url,
            Guid.NewGuid(),
            """{"name":"x","kind":"y","beneficiarySource":"API","organizationId":"6b2bc828-cf5d-4af7-a026-a653739d8509"}""");
        Assert.Equal(HttpStatusCode.BadRequest, forbiddenField.StatusCode);

        var creationKey = Guid.NewGuid();
        var created = await PostAsync(admin, url, creationKey, payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("no-store",
            created.Headers.GetValues("Cache-Control").Single());

        Guid createdId;
        using (var body = JsonDocument.Parse(
            await created.Content.ReadAsStringAsync()))
        {
            var root = body.RootElement;
            createdId = root.GetProperty("id").GetGuid();
            Assert.Equal("طرح رفاهی واقعی",
                root.GetProperty("name").GetString());
            Assert.Equal("الگوی حنا",
                root.GetProperty("allocationMethod").GetString());
            Assert.Equal("DRAFT",
                root.GetProperty("status").GetString());
            Assert.Equal(1, root.GetProperty("revision").GetInt32());
            Assert.False(root.TryGetProperty("organizationId", out _));
            Assert.False(root.TryGetProperty("creationKey", out _));
            Assert.False(root.TryGetProperty("createdByAccountId", out _));
        }

        organizations.ChangeTracker.Clear();
        var stored = await organizations.Programs.SingleAsync(
            p => p.Id == createdId);
        Assert.Equal(firstOrg, stored.OrganizationId);
        Assert.Equal(creationKey, stored.CreationKey);
        Assert.Matches("^[0-9a-f]{64}$", stored.CreationFingerprint!);
        Assert.Equal(adminId, stored.CreatedByAccountId);
        Assert.Equal(adminId, stored.UpdatedByAccountId);
        Assert.Equal("الگوی حنا", stored.AllocationMethod);
        Assert.Equal(1, stored.Revision);

        var replay = await PostAsync(admin, url, creationKey, payload);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using (var body = JsonDocument.Parse(
            await replay.Content.ReadAsStringAsync()))
            Assert.Equal(createdId,
                body.RootElement.GetProperty("id").GetGuid());
        Assert.Equal(1, await organizations.Programs.AsNoTracking()
            .CountAsync(p => p.OrganizationId == firstOrg &&
                p.CreationKey == creationKey));

        var changedReplay = await PostAsync(
            admin,
            url,
            creationKey,
            payload.Replace("طرح رفاهی واقعی", "نام دیگر"));
        Assert.Equal(HttpStatusCode.Conflict, changedReplay.StatusCode);

        // Concurrent equal retries must converge on one draft.
        var raceKey = Guid.NewGuid();
        var racePayload =
            """{"name":"طرح همزمان","kind":"اعتبار","beneficiarySource":"MANUAL","description":null}""";
        var raceResponses = await Task.WhenAll(
            PostAsync(admin, url, raceKey, racePayload),
            PostAsync(admin, url, raceKey, racePayload));
        Assert.All(raceResponses, response =>
            Assert.Contains(response.StatusCode,
                new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
        Assert.Equal(1, raceResponses.Count(
            response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, await organizations.Programs.AsNoTracking()
            .CountAsync(p => p.OrganizationId == firstOrg &&
                p.CreationKey == raceKey));

        var updatePayload =
            """{"name":"طرح رفاهی ویرایش‌شده","kind":"اعتبار رفاهی","beneficiarySource":"API_OR_MANUAL","description":"شرح دوم","revision":1}""";

        Assert.Equal(HttpStatusCode.Forbidden,
            (await PutAsync(
                viewer, url + "/" + createdId, updatePayload)).StatusCode);

        var forbiddenUpdateField = await PutAsync(
            admin,
            url + "/" + createdId,
            """{"name":"x","kind":"y","beneficiarySource":"API","description":null,"revision":1,"status":"ACTIVE"}""");
        Assert.Equal(
            HttpStatusCode.BadRequest, forbiddenUpdateField.StatusCode);

        var updated = await PutAsync(
            admin, url + "/" + createdId, updatePayload);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using (var body = JsonDocument.Parse(
            await updated.Content.ReadAsStringAsync()))
        {
            Assert.Equal(2,
                body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal("طرح رفاهی ویرایش‌شده",
                body.RootElement.GetProperty("name").GetString());
            Assert.Equal("الگوی حنا",
                body.RootElement.GetProperty("allocationMethod").GetString());
        }

        // POST replay stays idempotent even after the resource itself changed.
        var replayAfterEdit = await PostAsync(
            admin, url, creationKey, payload);
        Assert.Equal(HttpStatusCode.OK, replayAfterEdit.StatusCode);
        using (var body = JsonDocument.Parse(
            await replayAfterEdit.Content.ReadAsStringAsync()))
            Assert.Equal(createdId,
                body.RootElement.GetProperty("id").GetGuid());

        var stale = await PutAsync(
            admin, url + "/" + createdId, updatePayload);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using (var body = JsonDocument.Parse(
            await stale.Content.ReadAsStringAsync()))
            Assert.Equal(2,
                body.RootElement.GetProperty("currentRevision").GetInt32());

        Assert.Equal(HttpStatusCode.NotFound,
            (await PutAsync(
                admin, url + "/" + foreignProgramId,
                updatePayload)).StatusCode);

        var detail = await admin.GetAsync(url + "/" + createdId);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        using (var body = JsonDocument.Parse(
            await detail.Content.ReadAsStringAsync()))
            Assert.Equal(2,
                body.RootElement.GetProperty("revision").GetInt32());

        await organizations.Programs
            .Where(p => p.Id == createdId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Status, OrganizationProgramStates.Active));
        var locked = await PutAsync(
            admin,
            url + "/" + createdId,
            updatePayload.Replace("\"revision\":1", "\"revision\":2"));
        Assert.Equal(HttpStatusCode.Conflict, locked.StatusCode);

        organizations.ChangeTracker.Clear();
        stored = await organizations.Programs.AsNoTracking()
            .SingleAsync(p => p.Id == createdId);
        Assert.Equal(2, stored.Revision);
        Assert.Equal(adminId, stored.UpdatedByAccountId);
        Assert.Equal(
            OrganizationProgramStates.Active, stored.Status);
    }

    private static StringContent Json(string value) =>
        new(value, Encoding.UTF8, "application/json");

    private static async Task<HttpResponseMessage> PostAsync(
        HttpClient client,
        string url,
        Guid key,
        string body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Idempotency-Key", key.ToString());
        request.Content = Json(body);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutAsync(
        HttpClient client,
        string url,
        string body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = Json(body)
        };
        return await client.SendAsync(request);
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

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
