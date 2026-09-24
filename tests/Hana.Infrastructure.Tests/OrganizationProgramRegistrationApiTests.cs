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

public sealed class OrganizationProgramRegistrationApiTests
{
    [Fact]
    public async Task AdminRegistersDraftIdempotentlyWithRevisionAndTenantGuards()
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
        var draftId = Guid.NewGuid();
        var raceDraftId = Guid.NewGuid();
        var staleDraftId = Guid.NewGuid();
        var activeId = Guid.NewGuid();
        var foreignDraftId = Guid.NewGuid();

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
            Organization(firstOrg, "سازمان ثبت اول", now),
            Organization(secondOrg, "سازمان ثبت دوم", now));
        organizations.Memberships.AddRange(
            Membership(firstOrg, adminId,
                OrganizationProgramPermissions.PortalAdmin, now),
            Membership(firstOrg, viewerId, "PORTAL_VIEWER", now),
            Membership(secondOrg, otherAdminId,
                OrganizationProgramPermissions.PortalAdmin, now));
        organizations.Programs.AddRange(
            Program(draftId, firstOrg, "طرح قابل ثبت",
                OrganizationProgramStates.Draft, 1, now),
            Program(raceDraftId, firstOrg, "طرح retry همزمان",
                OrganizationProgramStates.Draft, 1, now),
            Program(staleDraftId, firstOrg, "طرح نسخه جدیدتر",
                OrganizationProgramStates.Draft, 2, now),
            Program(activeId, firstOrg, "طرح فعال",
                OrganizationProgramStates.Active, 4, now),
            Program(foreignDraftId, secondOrg, "طرح سازمان دوم",
                OrganizationProgramStates.Draft, 1, now));
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

        string RegisterUrl(Guid id) =>
            $"/api/v1/organization/programs/{id}/register";
        const string revisionOne = """{"revision":1}""";

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await PostRegisterAsync(
                anonymous, RegisterUrl(draftId), Guid.NewGuid(), revisionOne))
            .StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await PostRegisterAsync(
                viewer, RegisterUrl(draftId), Guid.NewGuid(), revisionOne))
            .StatusCode);

        var missingKey = await admin.PostAsync(
            RegisterUrl(draftId), Json(revisionOne));
        Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);

        var forbiddenBody = await PostRegisterAsync(
            admin,
            RegisterUrl(draftId),
            Guid.NewGuid(),
            """{"revision":1,"status":"ACTIVE"}""");
        Assert.Equal(HttpStatusCode.BadRequest, forbiddenBody.StatusCode);

        var stale = await PostRegisterAsync(
            admin,
            RegisterUrl(staleDraftId),
            Guid.NewGuid(),
            revisionOne);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using (var body = JsonDocument.Parse(
            await stale.Content.ReadAsStringAsync()))
        {
            Assert.Equal(2,
                body.RootElement.GetProperty("currentRevision").GetInt32());
        }

        var active = await PostRegisterAsync(
            admin,
            RegisterUrl(activeId),
            Guid.NewGuid(),
            """{"revision":4}""");
        Assert.Equal(HttpStatusCode.Conflict, active.StatusCode);
        using (var body = JsonDocument.Parse(
            await active.Content.ReadAsStringAsync()))
        {
            Assert.Equal("ACTIVE",
                body.RootElement.GetProperty("currentStatus").GetString());
        }

        Assert.Equal(HttpStatusCode.NotFound,
            (await PostRegisterAsync(
                admin,
                RegisterUrl(foreignDraftId),
                Guid.NewGuid(),
                revisionOne)).StatusCode);

        var registrationKey = Guid.NewGuid();
        var registered = await PostRegisterAsync(
            admin,
            RegisterUrl(draftId),
            registrationKey,
            revisionOne);
        Assert.Equal(HttpStatusCode.OK, registered.StatusCode);
        Assert.Equal("no-store",
            registered.Headers.GetValues("Cache-Control").Single());

        using (var body = JsonDocument.Parse(
            await registered.Content.ReadAsStringAsync()))
        {
            var root = body.RootElement;
            Assert.Equal(draftId, root.GetProperty("id").GetGuid());
            Assert.Equal("REGISTERED",
                root.GetProperty("status").GetString());
            Assert.Equal(2, root.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.String,
                root.GetProperty("registeredAtUtc").ValueKind);
            Assert.False(root.TryGetProperty("registrationKey", out _));
            Assert.False(root.TryGetProperty(
                "registeredByAccountId", out _));
            Assert.False(root.TryGetProperty("organizationId", out _));
        }

        organizations.ChangeTracker.Clear();
        var stored = await organizations.Programs.AsNoTracking()
            .SingleAsync(p => p.Id == draftId);
        Assert.Equal(OrganizationProgramStates.Registered, stored.Status);
        Assert.Equal(2, stored.Revision);
        Assert.Equal(registrationKey, stored.RegistrationKey);
        Assert.Equal(1, stored.RegistrationExpectedRevision);
        Assert.Equal(adminId, stored.RegisteredByAccountId);
        Assert.NotNull(stored.RegisteredAtUtc);
        Assert.Equal(adminId, stored.UpdatedByAccountId);

        var replay = await PostRegisterAsync(
            admin,
            RegisterUrl(draftId),
            registrationKey,
            revisionOne);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using (var body = JsonDocument.Parse(
            await replay.Content.ReadAsStringAsync()))
        {
            Assert.Equal("REGISTERED",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(2,
                body.RootElement.GetProperty("revision").GetInt32());
        }

        var sameKeyWrongRevision = await PostRegisterAsync(
            admin,
            RegisterUrl(draftId),
            registrationKey,
            """{"revision":2}""");
        Assert.Equal(
            HttpStatusCode.Conflict, sameKeyWrongRevision.StatusCode);

        var differentKeyAfterRegister = await PostRegisterAsync(
            admin,
            RegisterUrl(draftId),
            Guid.NewGuid(),
            revisionOne);
        Assert.Equal(
            HttpStatusCode.Conflict, differentKeyAfterRegister.StatusCode);

        // Same-key concurrent retries converge on one DRAFT->REGISTERED
        // transition and must not increment revision twice.
        var raceKey = Guid.NewGuid();
        var race = await Task.WhenAll(
            PostRegisterAsync(
                admin, RegisterUrl(raceDraftId), raceKey, revisionOne),
            PostRegisterAsync(
                admin, RegisterUrl(raceDraftId), raceKey, revisionOne));
        Assert.All(race,
            response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        organizations.ChangeTracker.Clear();
        var raceStored = await organizations.Programs.AsNoTracking()
            .SingleAsync(p => p.Id == raceDraftId);
        Assert.Equal(OrganizationProgramStates.Registered, raceStored.Status);
        Assert.Equal(2, raceStored.Revision);
        Assert.Equal(raceKey, raceStored.RegistrationKey);

        // Registered programs are no longer editable by the Draft PUT.
        var editRegistered = await PutAsync(
            admin,
            $"/api/v1/organization/programs/{draftId}",
            """{"name":"نباید تغییر کند","kind":"اعتبار","beneficiarySource":"API","description":null,"revision":2}""");
        Assert.Equal(HttpStatusCode.Conflict, editRegistered.StatusCode);

        var detail = await admin.GetAsync(
            $"/api/v1/organization/programs/{draftId}");
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        using (var body = JsonDocument.Parse(
            await detail.Content.ReadAsStringAsync()))
        {
            Assert.Equal("REGISTERED",
                body.RootElement.GetProperty("status").GetString());
            Assert.Equal(2,
                body.RootElement.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.String,
                body.RootElement.GetProperty("registeredAtUtc").ValueKind);
        }
    }

    private static StringContent Json(string value) =>
        new(value, Encoding.UTF8, "application/json");

    private static async Task<HttpResponseMessage> PostRegisterAsync(
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

    private static OrganizationProgramRecord Program(
        Guid id,
        Guid organizationId,
        string name,
        string status,
        int revision,
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار رفاهی",
        AllocationMethod = "الگوی حنا",
        BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
        Description = "داده تست ثبت طرح",
        Status = status,
        Revision = revision,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
