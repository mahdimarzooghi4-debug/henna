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

public sealed class OrganizationRecipientApiTests
{
    [Fact]
    public async Task RecipientListIsTenantScopedFilterableAndDoesNotImplyCredit()
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
        var matchedAccountId = Guid.NewGuid();
        var outsiderId = Guid.NewGuid();
        var firstOrg = Guid.NewGuid();
        var secondOrg = Guid.NewGuid();
        var firstProgram = Guid.NewGuid();
        var secondProgram = Guid.NewGuid();
        var matchedRecipient = Guid.NewGuid();
        var manualRecipient = Guid.NewGuid();
        var foreignRecipient = Guid.NewGuid();

        var memberToken = SessionTokenCodec.Generate();
        var outsiderToken = SessionTokenCodec.Generate();
        var revokedToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            memberToken, out var memberDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            outsiderToken, out var outsiderDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            revokedToken, out var revokedDigest));

        identity.Accounts.AddRange(
            Account(memberId, NewPhone(), now),
            Account(matchedAccountId, NewPhone(), now),
            Account(outsiderId, NewPhone(), now));
        identity.AuthSessions.AddRange(
            Session(memberId, memberDigest, now),
            Session(outsiderId, outsiderDigest, now),
            new AuthSessionRecord
            {
                Id = Guid.NewGuid(),
                AccountId = memberId,
                TokenDigest = revokedDigest,
                IssuedAtUtc = now.AddHours(-2),
                ExpiresAtUtc = now.AddHours(1),
                RevokedAtUtc = now.AddMinutes(-1)
            });
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(firstOrg, "سازمان مشمولان اول", now),
            Organization(secondOrg, "سازمان مشمولان دوم", now));
        organizations.Memberships.Add(
            Membership(firstOrg, memberId, "PORTAL_VIEWER", now));
        organizations.Programs.AddRange(
            Program(firstProgram, firstOrg, "طرح سلامت کارکنان", now),
            Program(secondProgram, secondOrg, "طرح محرمانه سازمان دوم", now));
        organizations.Recipients.AddRange(
            Recipient(
                matchedRecipient,
                firstOrg,
                firstProgram,
                "فرد واقعی یک",
                "۰۰۲****۳۲۱",
                OrganizationRecipientSources.Api,
                OrganizationRecipientMatchStates.Matched,
                matchedAccountId,
                now.AddMinutes(-2)),
            Recipient(
                manualRecipient,
                firstOrg,
                firstProgram,
                "فرد واقعی دو",
                "۱۲۸****۸۹۰",
                OrganizationRecipientSources.Manual,
                OrganizationRecipientMatchStates.NeedsMatch,
                null,
                now.AddMinutes(-1)),
            Recipient(
                foreignRecipient,
                secondOrg,
                secondProgram,
                "فرد سازمان دوم",
                "۹۹۹****۹۹۹",
                OrganizationRecipientSources.Api,
                OrganizationRecipientMatchStates.PendingReview,
                null,
                now));
        await organizations.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var member = factory.CreateClient();
        using var outsider = factory.CreateClient();
        using var revoked = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        member.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", memberToken);
        outsider.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", outsiderToken);
        revoked.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", revokedToken);

        const string url = "/api/v1/organization/recipients";

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await outsider.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await revoked.GetAsync(url)).StatusCode);

        var list = await member.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal("no-store",
            list.Headers.GetValues("Cache-Control").Single());
        using (var body = JsonDocument.Parse(
            await list.Content.ReadAsStringAsync()))
        {
            var root = body.RootElement;
            Assert.Equal(2, root.GetProperty("total").GetInt32());
            var items = root.GetProperty("items");
            Assert.Equal(2, items.GetArrayLength());

            var json = root.GetRawText();
            Assert.DoesNotContain(firstOrg.ToString(), json);
            Assert.DoesNotContain(secondOrg.ToString(), json);
            Assert.DoesNotContain(matchedAccountId.ToString(), json);
            Assert.DoesNotContain("طرح محرمانه سازمان دوم", json);
            Assert.DoesNotContain("allocation", json,
                StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("usage", json,
                StringComparison.OrdinalIgnoreCase);

            var matched = items.EnumerateArray()
                .Single(x => x.GetProperty("id").GetGuid() == matchedRecipient);
            Assert.True(matched.GetProperty(
                "hanaAccountMatched").GetBoolean());
            Assert.Equal("طرح سلامت کارکنان",
                matched.GetProperty("program")
                    .GetProperty("name").GetString());
        }

        var source = await member.GetAsync(
            url + "?source=manual");
        Assert.Equal(HttpStatusCode.OK, source.StatusCode);
        using (var body = JsonDocument.Parse(
            await source.Content.ReadAsStringAsync()))
        {
            Assert.Equal(1,
                body.RootElement.GetProperty("total").GetInt32());
            Assert.Equal(manualRecipient,
                body.RootElement.GetProperty("items")[0]
                    .GetProperty("id").GetGuid());
        }

        var matchedOnly = await member.GetAsync(
            url + "?matchStatus=MATCHED");
        Assert.Equal(HttpStatusCode.OK, matchedOnly.StatusCode);
        using (var body = JsonDocument.Parse(
            await matchedOnly.Content.ReadAsStringAsync()))
            Assert.Equal(1,
                body.RootElement.GetProperty("total").GetInt32());

        var searchName = await member.GetAsync(
            url + "?search=" +
            Uri.EscapeDataString("واقعی دو"));
        Assert.Equal(HttpStatusCode.OK, searchName.StatusCode);
        using (var body = JsonDocument.Parse(
            await searchName.Content.ReadAsStringAsync()))
            Assert.Equal(manualRecipient,
                body.RootElement.GetProperty("items")[0]
                    .GetProperty("id").GetGuid());

        var searchReference = await member.GetAsync(
            url + "?search=" +
            Uri.EscapeDataString("۳۲۱"));
        Assert.Equal(HttpStatusCode.OK, searchReference.StatusCode);
        using (var body = JsonDocument.Parse(
            await searchReference.Content.ReadAsStringAsync()))
            Assert.Equal(matchedRecipient,
                body.RootElement.GetProperty("items")[0]
                    .GetProperty("id").GetGuid());

        var ownProgram = await member.GetAsync(
            url + "?programId=" + firstProgram);
        Assert.Equal(HttpStatusCode.OK, ownProgram.StatusCode);
        using (var body = JsonDocument.Parse(
            await ownProgram.Content.ReadAsStringAsync()))
            Assert.Equal(2,
                body.RootElement.GetProperty("total").GetInt32());

        // A foreign program filter is indistinguishable from an empty local
        // result and cannot be used to enumerate another organization's data.
        var foreignProgram = await member.GetAsync(
            url + "?programId=" + secondProgram);
        Assert.Equal(HttpStatusCode.OK, foreignProgram.StatusCode);
        using (var body = JsonDocument.Parse(
            await foreignProgram.Content.ReadAsStringAsync()))
            Assert.Equal(0,
                body.RootElement.GetProperty("total").GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(
                url + "?organizationId=" + firstOrg)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(url + "?source=CSV")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(
                url + "?matchStatus=UNKNOWN")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(url + "?pageSize=51")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(url + "?programId=nope")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await member.GetAsync(url + "?source=API&source=MANUAL"))
                .StatusCode);
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
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Name = name,
        Kind = "اعتبار رفاهی",
        AllocationMethod = "الگوی حنا",
        BeneficiarySource = OrganizationBeneficiarySources.ApiOrManual,
        Description = null,
        Status = OrganizationProgramStates.Registered,
        Revision = 2,
        CreatedAtUtc = now,
        UpdatedAtUtc = now
    };

    private static OrganizationRecipientRecord Recipient(
        Guid id,
        Guid organizationId,
        Guid programId,
        string name,
        string referenceMasked,
        string source,
        string matchStatus,
        Guid? matchedAccountId,
        DateTimeOffset now) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        ProgramId = programId,
        DisplayName = name,
        ReferenceMasked = referenceMasked,
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
