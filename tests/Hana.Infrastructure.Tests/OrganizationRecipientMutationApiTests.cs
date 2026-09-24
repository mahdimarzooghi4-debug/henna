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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationRecipientMutationApiTests
{
    private const string FingerprintKeyBase64 =
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    [Fact]
    public async Task AdminCreatesManualRecipientWithIdempotencyDuplicateAndMatchGuards()
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
        var matchedAccountId = Guid.NewGuid();
        var firstOrg = Guid.NewGuid();
        var secondOrg = Guid.NewGuid();
        var registeredProgram = Guid.NewGuid();
        var activeProgram = Guid.NewGuid();
        var draftProgram = Guid.NewGuid();
        var pausedProgram = Guid.NewGuid();
        var endedProgram = Guid.NewGuid();
        var foreignProgram = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var viewerToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            viewerToken, out var viewerDigest));

        const string matchedPhone = "09121112233";
        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(viewerId, NewPhone(), now),
            Account(matchedAccountId, matchedPhone, now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminDigest, now),
            Session(viewerId, viewerDigest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(firstOrg, "سازمان ثبت مشمول", now),
            Organization(secondOrg, "سازمان دوم ثبت مشمول", now));
        organizations.Memberships.AddRange(
            Membership(
                firstOrg,
                adminId,
                OrganizationProgramPermissions.PortalAdmin,
                now),
            Membership(firstOrg, viewerId, "PORTAL_VIEWER", now));
        organizations.Programs.AddRange(
            Program(
                registeredProgram,
                firstOrg,
                "طرح ثبت‌شده",
                OrganizationProgramStates.Registered,
                now),
            Program(
                activeProgram,
                firstOrg,
                "طرح فعال",
                OrganizationProgramStates.Active,
                now),
            Program(
                draftProgram,
                firstOrg,
                "طرح پیش‌نویس",
                OrganizationProgramStates.Draft,
                now),
            Program(
                pausedProgram,
                firstOrg,
                "طرح متوقف",
                OrganizationProgramStates.Paused,
                now),
            Program(
                endedProgram,
                firstOrg,
                "طرح پایان‌یافته",
                OrganizationProgramStates.Ended,
                now),
            Program(
                foreignProgram,
                secondOrg,
                "طرح سازمان دیگر",
                OrganizationProgramStates.Registered,
                now));
        await organizations.SaveChangesAsync();

        using var factory = Factory();
        using var admin = factory.CreateClient();
        using var viewer = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", adminToken);
        viewer.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", viewerToken);

        const string url = "/api/v1/organization/recipients";

        var baseBody = Body(
            "فرد جدید",
            "۰۰۲۱۲۳۴۵۶",
            null,
            registeredProgram);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await PostAsync(
                anonymous, url, Guid.NewGuid(), baseBody)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await PostAsync(
                viewer, url, Guid.NewGuid(), baseBody)).StatusCode);

        var missingKey = await admin.PostAsync(url, Json(baseBody));
        Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);

        var extraField = await PostRawAsync(
            admin,
            url,
            Guid.NewGuid(),
            $$"""
            {
              "displayName":"فرد جدید",
              "externalReference":"۰۰۲۱۲۳۴۵۶",
              "phone":null,
              "programId":"{{registeredProgram}}",
              "organizationId":"{{firstOrg}}"
            }
            """);
        Assert.Equal(HttpStatusCode.BadRequest, extraField.StatusCode);

        var queryMutation = await PostAsync(
            admin,
            url + "?source=MANUAL",
            Guid.NewGuid(),
            baseBody);
        Assert.Equal(HttpStatusCode.BadRequest, queryMutation.StatusCode);

        var invalidPhone = await PostAsync(
            admin,
            url,
            Guid.NewGuid(),
            Body(
                "فرد شماره نامعتبر",
                "REF-PHONE-BAD",
                "123",
                registeredProgram));
        Assert.Equal(HttpStatusCode.BadRequest, invalidPhone.StatusCode);

        var foreign = await PostAsync(
            admin,
            url,
            Guid.NewGuid(),
            Body("فرد خارجی", "FOREIGN-1", null, foreignProgram));
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);

        foreach (var (programId, expectedStatus) in new[]
        {
            (draftProgram, OrganizationProgramStates.Draft),
            (pausedProgram, OrganizationProgramStates.Paused),
            (endedProgram, OrganizationProgramStates.Ended)
        })
        {
            var rejected = await PostAsync(
                admin,
                url,
                Guid.NewGuid(),
                Body("فرد وضعیت بسته", Guid.NewGuid().ToString("N"),
                    null, programId));
            Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
            using var rejectedBody = JsonDocument.Parse(
                await rejected.Content.ReadAsStringAsync());
            Assert.Equal(
                expectedStatus,
                rejectedBody.RootElement.GetProperty(
                    "currentStatus").GetString());
        }

        var creationKey = Guid.NewGuid();
        var created = await PostAsync(admin, url, creationKey, baseBody);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(
            "no-store",
            created.Headers.GetValues("Cache-Control").Single());
        var createdText = await created.Content.ReadAsStringAsync();
        using var createdJson = JsonDocument.Parse(createdText);
        var createdRoot = createdJson.RootElement;
        var recipientId = createdRoot.GetProperty("id").GetGuid();
        Assert.Equal("فرد جدید",
            createdRoot.GetProperty("displayName").GetString());
        Assert.Equal("002****456",
            createdRoot.GetProperty("referenceMasked").GetString());
        Assert.Equal("MANUAL",
            createdRoot.GetProperty("source").GetString());
        Assert.Equal("NEEDS_MATCH",
            createdRoot.GetProperty("matchStatus").GetString());
        Assert.False(
            createdRoot.GetProperty("hanaAccountMatched").GetBoolean());
        Assert.Equal(
            registeredProgram,
            createdRoot.GetProperty("program")
                .GetProperty("id").GetGuid());
        Assert.DoesNotContain("002123456", createdText);
        Assert.DoesNotContain("۰۰۲۱۲۳۴۵۶", createdText);
        Assert.DoesNotContain("referenceFingerprint", createdText);
        Assert.DoesNotContain("creationFingerprint", createdText);
        Assert.DoesNotContain("creationKey", createdText);
        Assert.DoesNotContain("createdByAccountId", createdText);
        Assert.DoesNotContain("allocation", createdText,
            StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("usage", createdText,
            StringComparison.OrdinalIgnoreCase);

        organizations.ChangeTracker.Clear();
        var stored = await organizations.Recipients.AsNoTracking()
            .SingleAsync(r => r.Id == recipientId);
        Assert.Equal(firstOrg, stored.OrganizationId);
        Assert.Equal(registeredProgram, stored.ProgramId);
        Assert.Equal("002****456", stored.ReferenceMasked);
        Assert.NotNull(stored.ReferenceFingerprint);
        Assert.Equal(64, stored.ReferenceFingerprint!.Length);
        Assert.Equal(creationKey, stored.CreationKey);
        Assert.NotNull(stored.CreationFingerprint);
        Assert.Equal(64, stored.CreationFingerprint!.Length);
        Assert.Equal(adminId, stored.CreatedByAccountId);
        Assert.Null(stored.MatchedAccountId);
        Assert.Equal(OrganizationRecipientMatchStates.NeedsMatch,
            stored.MatchStatus);

        var replay = await PostAsync(admin, url, creationKey, baseBody);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using (var body = JsonDocument.Parse(
            await replay.Content.ReadAsStringAsync()))
            Assert.Equal(recipientId,
                body.RootElement.GetProperty("id").GetGuid());

        var changedSameKey = await PostAsync(
            admin,
            url,
            creationKey,
            Body(
                "نام تغییرکرده",
                "۰۰۲۱۲۳۴۵۶",
                null,
                registeredProgram));
        Assert.Equal(HttpStatusCode.Conflict, changedSameKey.StatusCode);

        // Persian/Arabic/ASCII digit forms converge to the same pseudonymous
        // reference, so a second key cannot create a duplicate in one program.
        var duplicate = await PostAsync(
            admin,
            url,
            Guid.NewGuid(),
            Body(
                "نام دیگری",
                "002123456",
                null,
                registeredProgram));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        using (var body = JsonDocument.Parse(
            await duplicate.Content.ReadAsStringAsync()))
            Assert.Equal(recipientId,
                body.RootElement.GetProperty(
                    "existingRecipientId").GetGuid());

        // Duplicate identity is scoped to one program: the same organization
        // reference may legitimately participate in another eligible program.
        var otherProgram = await PostAsync(
            admin,
            url,
            Guid.NewGuid(),
            Body(
                "فرد جدید",
                "002123456",
                null,
                activeProgram));
        Assert.Equal(HttpStatusCode.Created, otherProgram.StatusCode);

        var matchKey = Guid.NewGuid();
        var matched = await PostAsync(
            admin,
            url,
            matchKey,
            Body(
                "فرد دارای حساب حنا",
                "EMP-9001",
                "۰۹۱۲۱۱۱۲۲۳۳",
                activeProgram));
        Assert.Equal(HttpStatusCode.Created, matched.StatusCode);
        var matchedText = await matched.Content.ReadAsStringAsync();
        using (var body = JsonDocument.Parse(matchedText))
        {
            Assert.Equal("MATCHED",
                body.RootElement.GetProperty("matchStatus").GetString());
            Assert.True(body.RootElement.GetProperty(
                "hanaAccountMatched").GetBoolean());
        }
        Assert.DoesNotContain(matchedPhone, matchedText);
        Assert.DoesNotContain(matchedAccountId.ToString(), matchedText);

        organizations.ChangeTracker.Clear();
        var matchedStored = await organizations.Recipients.AsNoTracking()
            .SingleAsync(r => r.CreationKey == matchKey);
        Assert.Equal(matchedAccountId, matchedStored.MatchedAccountId);
        Assert.Equal(OrganizationRecipientMatchStates.Matched,
            matchedStored.MatchStatus);

        // Idempotent replay is about the already committed create, so later
        // program-state changes do not turn a safe network retry into 409.
        await organizations.Programs
            .Where(p => p.Id == registeredProgram)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(
                    p => p.Status,
                    OrganizationProgramStates.Paused));
        var replayAfterPause = await PostAsync(
            admin, url, creationKey, baseBody);
        Assert.Equal(HttpStatusCode.OK, replayAfterPause.StatusCode);
        using (var body = JsonDocument.Parse(
            await replayAfterPause.Content.ReadAsStringAsync()))
            Assert.Equal(recipientId,
                body.RootElement.GetProperty("id").GetGuid());

        // Same-key concurrent retries converge on one row.
        var raceProgram = Guid.NewGuid();
        organizations.Programs.Add(
            Program(
                raceProgram,
                firstOrg,
                "طرح مسابقه idempotency",
                OrganizationProgramStates.Registered,
                now));
        await organizations.SaveChangesAsync();

        var raceKey = Guid.NewGuid();
        var raceBody = Body(
            "فرد همزمان",
            "RACE-9000",
            null,
            raceProgram);
        var race = await Task.WhenAll(
            PostAsync(admin, url, raceKey, raceBody),
            PostAsync(admin, url, raceKey, raceBody));
        Assert.All(race, response => Assert.Contains(
            response.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
        Assert.Single(
            race,
            response => response.StatusCode == HttpStatusCode.Created);

        organizations.ChangeTracker.Clear();
        Assert.Equal(1, await organizations.Recipients.CountAsync(
            r => r.OrganizationId == firstOrg &&
                r.ProgramId == raceProgram &&
                r.CreationKey == raceKey));
    }

    [Fact]
    public async Task ManualCreateFailsClosedWithoutRecipientFingerprintSecret()
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
        var adminId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var programId = Guid.NewGuid();
        var token = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(token, out var digest));

        identity.Accounts.Add(Account(adminId, NewPhone(), now));
        identity.AuthSessions.Add(Session(adminId, digest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.Add(
            Organization(orgId, "سازمان بدون کلید", now));
        organizations.Memberships.Add(
            Membership(
                orgId,
                adminId,
                OrganizationProgramPermissions.PortalAdmin,
                now));
        organizations.Programs.Add(
            Program(
                programId,
                orgId,
                "طرح بدون کلید",
                OrganizationProgramStates.Registered,
                now));
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                // The CI process itself supplies a valid fingerprint secret.
                // Remove the resolved service explicitly so this test exercises
                // the real runtime path when the mutation secret is unavailable.
                builder.ConfigureServices(services =>
                    services.RemoveAll<OrganizationRecipientCryptography>());
            });
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var response = await PostAsync(
            client,
            "/api/v1/organization/recipients",
            Guid.NewGuid(),
            Body("فرد بدون کلید", "NO-KEY-1", null, programId));
        Assert.Equal(
            HttpStatusCode.ServiceUnavailable,
            response.StatusCode);
    }

    private static WebApplicationFactory<Program> Factory() =>
        new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureAppConfiguration((_, configuration) =>
                    configuration.AddInMemoryCollection(
                        new Dictionary<string, string?>
                        {
                            ["OrganizationRecipients:FingerprintKeyBase64"] =
                                FingerprintKeyBase64
                        }));
            });

    private static object Body(
        string displayName,
        string externalReference,
        string? phone,
        Guid programId) => new
    {
        displayName,
        externalReference,
        phone,
        programId
    };

    private static StringContent Json(object value) =>
        new(
            JsonSerializer.Serialize(value),
            Encoding.UTF8,
            "application/json");

    private static async Task<HttpResponseMessage> PostAsync(
        HttpClient client,
        string url,
        Guid key,
        object body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Idempotency-Key", key.ToString());
        request.Content = Json(body);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostRawAsync(
        HttpClient client,
        string url,
        Guid key,
        string body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Idempotency-Key", key.ToString());
        request.Content = new StringContent(
            body,
            Encoding.UTF8,
            "application/json");
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
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار رفاهی",
        AllocationMethod = "الگوی حنا",
        BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
        Description = null,
        Status = status,
        Revision = status == OrganizationProgramStates.Draft ? 1 : 2,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
