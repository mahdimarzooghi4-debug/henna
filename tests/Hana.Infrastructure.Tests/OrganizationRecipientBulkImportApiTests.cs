using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationRecipientBulkImportApiTests
{
    private const string FingerprintKeyBase64 =
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    [Fact]
    public async Task CsvImportIsAtomicIdempotentTenantScopedAndPrivate()
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
        var foreignProgram = Guid.NewGuid();

        var adminToken = SessionTokenCodec.Generate();
        var viewerToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            adminToken, out var adminDigest));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            viewerToken, out var viewerDigest));

        var matchedPhone = NewPhone();
        identity.Accounts.AddRange(
            Account(adminId, NewPhone(), now),
            Account(viewerId, NewPhone(), now),
            Account(matchedAccountId, matchedPhone, now));
        identity.AuthSessions.AddRange(
            Session(adminId, adminDigest, now),
            Session(viewerId, viewerDigest, now));
        await identity.SaveChangesAsync();

        organizations.Organizations.AddRange(
            Organization(firstOrg, "سازمان import اول", now),
            Organization(secondOrg, "سازمان import دوم", now));
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
                "طرح ثبت‌شده import",
                OrganizationProgramStates.Registered,
                now),
            Program(
                activeProgram,
                firstOrg,
                "طرح فعال import",
                OrganizationProgramStates.Active,
                now),
            Program(
                draftProgram,
                firstOrg,
                "طرح پیش‌نویس import",
                OrganizationProgramStates.Draft,
                now),
            Program(
                foreignProgram,
                secondOrg,
                "طرح سازمان دوم import",
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

        const string url = "/api/v1/organization/recipients/import";
        var validCsv = Csv(
            "displayName,externalReference,phone",
            $\""فرد، اول\",EMP-000001,{ToPersianDigits(matchedPhone)}",
            "فرد دوم,EMP-000002,");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await PostImportAsync(
                anonymous,
                url,
                Guid.NewGuid(),
                registeredProgram,
                validCsv,
                "people.csv")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await PostImportAsync(
                viewer,
                url,
                Guid.NewGuid(),
                registeredProgram,
                validCsv,
                "people.csv")).StatusCode);

        var missingKey = await PostImportWithoutKeyAsync(
            admin,
            url,
            registeredProgram,
            validCsv,
            "people.csv");
        Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);

        var foreign = await PostImportAsync(
            admin,
            url,
            Guid.NewGuid(),
            foreignProgram,
            validCsv,
            "people.csv");
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);

        var draft = await PostImportAsync(
            admin,
            url,
            Guid.NewGuid(),
            draftProgram,
            validCsv,
            "people.csv");
        Assert.Equal(HttpStatusCode.Conflict, draft.StatusCode);
        using (var body = JsonDocument.Parse(
            await draft.Content.ReadAsStringAsync()))
            Assert.Equal(
                OrganizationProgramStates.Draft,
                body.RootElement.GetProperty(
                    "currentStatus").GetString());

        var invalidKey = Guid.NewGuid();
        var invalidCsv = Csv(
            "نام,شناسه موردنیاز,شماره همراه",
            "ردیف سالم,ATOMIC-1,",
            "ردیف خراب,ATOMIC-2,123");
        var invalid = await PostImportAsync(
            admin,
            url,
            invalidKey,
            registeredProgram,
            invalidCsv,
            "invalid.csv");
        Assert.Equal(
            HttpStatusCode.UnprocessableEntity,
            invalid.StatusCode);
        using (var body = JsonDocument.Parse(
            await invalid.Content.ReadAsStringAsync()))
        {
            Assert.Equal(0,
                body.RootElement.GetProperty(
                    "importedCount").GetInt32());
            Assert.True(
                body.RootElement.GetProperty("atomic").GetBoolean());
            Assert.Contains(
                body.RootElement.GetProperty("errors")
                    .EnumerateArray(),
                error =>
                    error.GetProperty("row").GetInt32() == 3 &&
                    error.GetProperty("code").GetString() ==
                        "INVALID_PHONE");
        }
        Assert.False(await organizations.RecipientImports.AsNoTracking()
            .AnyAsync(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == invalidKey));
        Assert.False(await organizations.Recipients.AsNoTracking()
            .AnyAsync(x =>
                x.OrganizationId == firstOrg &&
                x.DisplayName == "ردیف سالم"));

        var duplicateInFile = await PostImportAsync(
            admin,
            url,
            Guid.NewGuid(),
            registeredProgram,
            Csv(
                "displayName,externalReference,phone",
                "تکراری اول,۰۰۱۲۳,",
                "تکراری دوم,00123,"),
            "duplicates.csv");
        Assert.Equal(
            HttpStatusCode.UnprocessableEntity,
            duplicateInFile.StatusCode);
        using (var body = JsonDocument.Parse(
            await duplicateInFile.Content.ReadAsStringAsync()))
            Assert.Contains(
                body.RootElement.GetProperty("errors")
                    .EnumerateArray(),
                error =>
                    error.GetProperty("code").GetString() ==
                        "DUPLICATE_IN_FILE");

        var importKey = Guid.NewGuid();
        var created = await PostImportAsync(
            admin,
            url,
            importKey,
            registeredProgram,
            validCsv,
            "people.csv");
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(
            "no-store",
            created.Headers.GetValues("Cache-Control").Single());
        var createdText = await created.Content.ReadAsStringAsync();
        using var createdJson = JsonDocument.Parse(createdText);
        var root = createdJson.RootElement;
        Assert.Equal(2,
            root.GetProperty("importedCount").GetInt32());
        Assert.Equal(1,
            root.GetProperty("matchedCount").GetInt32());
        Assert.Equal(1,
            root.GetProperty("needsMatchCount").GetInt32());
        Assert.True(root.GetProperty("atomic").GetBoolean());
        Assert.Equal(2,
            root.GetProperty("items").GetArrayLength());
        Assert.Contains("EMP****001", createdText);
        Assert.Contains("EMP****002", createdText);
        Assert.DoesNotContain("EMP-000001", createdText);
        Assert.DoesNotContain("EMP-000002", createdText);
        Assert.DoesNotContain(matchedPhone, createdText);
        Assert.DoesNotContain(matchedAccountId.ToString(), createdText);
        Assert.DoesNotContain(firstOrg.ToString(), createdText);
        Assert.DoesNotContain("batchFingerprint", createdText);
        Assert.DoesNotContain("creationFingerprint", createdText);
        Assert.DoesNotContain("referenceFingerprint", createdText);
        Assert.DoesNotContain("importKey", createdText);
        Assert.DoesNotContain("createdByAccountId", createdText);
        Assert.DoesNotContain("allocation", createdText,
            StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("usage", createdText,
            StringComparison.OrdinalIgnoreCase);

        organizations.ChangeTracker.Clear();
        var import = await organizations.RecipientImports.AsNoTracking()
            .SingleAsync(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == importKey);
        Assert.Equal(registeredProgram, import.ProgramId);
        Assert.Equal(2, import.RowCount);
        Assert.Equal(64, import.BatchFingerprint.Length);
        Assert.Equal(adminId, import.CreatedByAccountId);

        var stored = await organizations.Recipients.AsNoTracking()
            .Where(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == importKey)
            .OrderBy(x => x.ImportRowNumber)
            .ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.Equal(new int?[] { 2, 3 },
            stored.Select(x => x.ImportRowNumber).ToArray());
        Assert.All(stored, x =>
        {
            Assert.Equal(importKey, x.ImportKey);
            Assert.Equal(adminId, x.CreatedByAccountId);
            Assert.NotNull(x.ReferenceFingerprint);
            Assert.Equal(64, x.ReferenceFingerprint!.Length);
            Assert.NotNull(x.CreationFingerprint);
            Assert.Equal(64, x.CreationFingerprint!.Length);
        });
        Assert.Equal(matchedAccountId, stored[0].MatchedAccountId);
        Assert.Equal(
            OrganizationRecipientMatchStates.Matched,
            stored[0].MatchStatus);
        Assert.Null(stored[1].MatchedAccountId);
        Assert.Equal(
            OrganizationRecipientMatchStates.NeedsMatch,
            stored[1].MatchStatus);

        var replay = await PostImportAsync(
            admin,
            url,
            importKey,
            registeredProgram,
            validCsv,
            "same-content.csv");
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using (var body = JsonDocument.Parse(
            await replay.Content.ReadAsStringAsync()))
            Assert.Equal(2,
                body.RootElement.GetProperty(
                    "importedCount").GetInt32());

        var changedSameKey = await PostImportAsync(
            admin,
            url,
            importKey,
            registeredProgram,
            Csv(
                "displayName,externalReference,phone",
                $"نام تغییرکرده,EMP-000001,{ToPersianDigits(matchedPhone)}",
                "فرد دوم,EMP-000002,"),
            "changed.csv");
        Assert.Equal(
            HttpStatusCode.Conflict,
            changedSameKey.StatusCode);

        // A different batch key that contains any existing recipient must
        // fail as a whole: the new row in the same file must not be inserted.
        var duplicateExistingKey = Guid.NewGuid();
        var duplicateExisting = await PostImportAsync(
            admin,
            url,
            duplicateExistingKey,
            registeredProgram,
            Csv(
                "displayName,externalReference,phone",
                "وجود دارد,EMP-000001,",
                "نباید درج شود,NEW-ATOMIC-99,"),
            "existing.csv");
        Assert.Equal(
            HttpStatusCode.Conflict,
            duplicateExisting.StatusCode);
        Assert.False(await organizations.RecipientImports.AsNoTracking()
            .AnyAsync(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == duplicateExistingKey));
        Assert.False(await organizations.Recipients.AsNoTracking()
            .AnyAsync(x =>
                x.OrganizationId == firstOrg &&
                x.DisplayName == "نباید درج شود"));

        // Safe replay is evaluated before the current program-state rule.
        await organizations.Programs
            .Where(p => p.Id == registeredProgram)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(
                    p => p.Status,
                    OrganizationProgramStates.Paused));
        var replayAfterPause = await PostImportAsync(
            admin,
            url,
            importKey,
            registeredProgram,
            validCsv,
            "replay.csv");
        Assert.Equal(
            HttpStatusCode.OK,
            replayAfterPause.StatusCode);

        // Concurrent equal requests converge on one committed import.
        var raceKey = Guid.NewGuid();
        var raceCsv = Csv(
            "displayName,externalReference,phone",
            "همزمان یک,RACE-BULK-1,",
            "همزمان دو,RACE-BULK-2,");
        var race = await Task.WhenAll(
            PostImportAsync(
                admin,
                url,
                raceKey,
                activeProgram,
                raceCsv,
                "race.csv"),
            PostImportAsync(
                admin,
                url,
                raceKey,
                activeProgram,
                raceCsv,
                "race.csv"));
        Assert.All(race, response => Assert.Contains(
            response.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
        Assert.Single(
            race,
            response => response.StatusCode ==
                HttpStatusCode.Created);
        organizations.ChangeTracker.Clear();
        Assert.Equal(1,
            await organizations.RecipientImports.CountAsync(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == raceKey));
        Assert.Equal(2,
            await organizations.Recipients.CountAsync(x =>
                x.OrganizationId == firstOrg &&
                x.ImportKey == raceKey));
    }

    [Fact]
    public async Task XlsxImportSupportsTextCellsAndRejectsNumericIdentityCells()
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
            Organization(orgId, "سازمان XLSX", now));
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
                "طرح XLSX",
                OrganizationProgramStates.Active,
                now));
        await organizations.SaveChangesAsync();

        using var factory = Factory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        const string url = "/api/v1/organization/recipients/import";

        var valid = await PostImportAsync(
            client,
            url,
            Guid.NewGuid(),
            programId,
            Xlsx(
                "فرد XLSX",
                "XLSX-0007",
                "",
                numericReference: false),
            "people.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        Assert.Equal(HttpStatusCode.Created, valid.StatusCode);
        var validText = await valid.Content.ReadAsStringAsync();
        Assert.Contains("XLS****007", validText);
        Assert.DoesNotContain("XLSX-0007", validText);

        var numericKey = Guid.NewGuid();
        var numeric = await PostImportAsync(
            client,
            url,
            numericKey,
            programId,
            Xlsx(
                "فرد عددی",
                "00123",
                "",
                numericReference: true),
            "numeric.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        Assert.Equal(
            HttpStatusCode.UnprocessableEntity,
            numeric.StatusCode);
        using (var body = JsonDocument.Parse(
            await numeric.Content.ReadAsStringAsync()))
            Assert.Contains(
                body.RootElement.GetProperty("errors")
                    .EnumerateArray(),
                error =>
                    error.GetProperty("field").GetString() ==
                        "externalReference" &&
                    error.GetProperty("code").GetString() ==
                        "TEXT_REQUIRED");

        Assert.False(await organizations.RecipientImports.AsNoTracking()
            .AnyAsync(x =>
                x.OrganizationId == orgId &&
                x.ImportKey == numericKey));

        var wrongType = await PostImportAsync(
            client,
            url,
            Guid.NewGuid(),
            programId,
            Encoding.UTF8.GetBytes("not a spreadsheet"),
            "people.txt",
            "text/plain");
        Assert.Equal(
            HttpStatusCode.UnprocessableEntity,
            wrongType.StatusCode);
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

    private static byte[] Csv(params string[] lines) =>
        Encoding.UTF8.GetBytes(string.Join("\n", lines) + "\n");

    private static async Task<HttpResponseMessage> PostImportAsync(
        HttpClient client,
        string url,
        Guid key,
        Guid programId,
        byte[] file,
        string fileName,
        string contentType = "text/csv")
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Idempotency-Key", key.ToString());
        request.Content = Multipart(
            programId,
            file,
            fileName,
            contentType);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostImportWithoutKeyAsync(
        HttpClient client,
        string url,
        Guid programId,
        byte[] file,
        string fileName)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = Multipart(
                programId,
                file,
                fileName,
                "text/csv")
        };
        return await client.SendAsync(request);
    }

    private static MultipartFormDataContent Multipart(
        Guid programId,
        byte[] file,
        string fileName,
        string contentType)
    {
        var multipart = new MultipartFormDataContent();
        multipart.Add(
            new StringContent(programId.ToString()),
            "programId");
        var fileContent = new ByteArrayContent(file);
        fileContent.Headers.ContentType =
            new MediaTypeHeaderValue(contentType);
        multipart.Add(fileContent, "file", fileName);
        return multipart;
    }

    private static byte[] Xlsx(
        string displayName,
        string reference,
        string phone,
        bool numericReference)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(
            stream,
            ZipArchiveMode.Create,
            leaveOpen: true))
        {
            WriteEntry(
                archive,
                "xl/workbook.xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """);
            WriteEntry(
                archive,
                "xl/_rels/workbook.xml.rels",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
                    Target="worksheets/sheet1.xml"/>
                </Relationships>
                """);

            XNamespace ns =
                "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var sheet = new XDocument(
                new XElement(ns + "worksheet",
                    new XElement(ns + "sheetData",
                        Row(ns, 1,
                            TextCell(ns, "A1", "displayName"),
                            TextCell(ns, "B1", "externalReference"),
                            TextCell(ns, "C1", "phone")),
                        Row(ns, 2,
                            TextCell(ns, "A2", displayName),
                            numericReference
                                ? NumberCell(ns, "B2", reference)
                                : TextCell(ns, "B2", reference),
                            TextCell(ns, "C2", phone)))));
            WriteEntry(
                archive,
                "xl/worksheets/sheet1.xml",
                sheet.ToString(SaveOptions.DisableFormatting));
        }

        return stream.ToArray();
    }

    private static XElement Row(
        XNamespace ns,
        int row,
        params XElement[] cells) =>
        new(
            ns + "row",
            new XAttribute("r", row),
            cells);

    private static XElement TextCell(
        XNamespace ns,
        string reference,
        string value) =>
        new(
            ns + "c",
            new XAttribute("r", reference),
            new XAttribute("t", "inlineStr"),
            new XElement(
                ns + "is",
                new XElement(ns + "t", value)));

    private static XElement NumberCell(
        XNamespace ns,
        string reference,
        string value) =>
        new(
            ns + "c",
            new XAttribute("r", reference),
            new XElement(ns + "v", value));

    private static void WriteEntry(
        ZipArchive archive,
        string path,
        string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(
            entry.Open(),
            new UTF8Encoding(false));
        writer.Write(content);
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

    private static string ToPersianDigits(string value) =>
        string.Concat(value.Select(ch => ch switch
        {
            >= '0' and <= '9' => (char)('\u06F0' + ch - '0'),
            _ => ch
        }));

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
}
