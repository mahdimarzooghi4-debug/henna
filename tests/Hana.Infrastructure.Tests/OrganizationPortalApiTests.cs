using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Geography;
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
        var outsiderId = Guid.NewGuid();
        var adminToken = SessionTokenCodec.Generate();
        var memberToken = SessionTokenCodec.Generate();
        var unrelatedToken = SessionTokenCodec.Generate();
        var outsiderToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(adminToken, out var adminHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(memberToken, out var memberHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(unrelatedToken, out var unrelatedHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(outsiderToken, out var outsiderHash));
        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options;
        var organizationOptions = new DbContextOptionsBuilder<HanaOrganizationDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "organization")).Options;
        var geographyOptions = new DbContextOptionsBuilder<HanaGeographyDbContext>().UseNpgsql(connection, pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "geography")).Options;
        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var organizations = new HanaOrganizationDbContext(organizationOptions);
        await using var geography = new HanaGeographyDbContext(geographyOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await organizations.Database.GetPendingMigrationsAsync());
        Assert.Empty(await geography.Database.GetPendingMigrationsAsync());
        identity.Accounts.AddRange(Account(adminId, now), Account(memberId, now), Account(unrelatedId, now), Account(outsiderId, now));
        identity.AuthSessions.AddRange(Session(adminId, adminHash, now), Session(memberId, memberHash, now), Session(unrelatedId, unrelatedHash, now), Session(outsiderId, outsiderHash, now));
        identity.RoleAssignments.Add(new RoleAssignmentRecord { AccountId = adminId, Role = HanaRoles.Admin, GrantedAtUtc = now });
        await identity.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var admin = factory.CreateClient();
        using var member = factory.CreateClient();
        using var unrelated = factory.CreateClient();
        using var outsider = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        member.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        unrelated.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", unrelatedToken);
        outsider.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", outsiderToken);

        const string profileUrl = "/api/v1/organization/profiles";
        const string programsUrl = "/api/v1/organization/programs";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(profileUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.PostAsJsonAsync("/api/v1/admin/organizations", new { name = "داده سازمان تست", initialAccountId = memberId, role = OrganizationRoles.Representative })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.GetAsync(profileUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.GetAsync(programsUrl)).StatusCode);

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

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(programsUrl)).StatusCode);

        var hennaModeKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Add("Idempotency-Key", hennaModeKey.ToString());
        var hennaModeRequest = new { organizationId = orgId, name = "طرح محاسبه حنا", allocationMode = OrganizationAllocationModes.HennaNeedsBased, description = "پیش‌نویس" };
        var hennaModeCreated = await member.PostAsJsonAsync(programsUrl, hennaModeRequest);
        Assert.Equal(HttpStatusCode.Created, hennaModeCreated.StatusCode);
        var hennaModeReplay = await member.PostAsJsonAsync(programsUrl, hennaModeRequest);
        Assert.Equal(HttpStatusCode.OK, hennaModeReplay.StatusCode);
        using var hennaModeBody = JsonDocument.Parse(await hennaModeCreated.Content.ReadAsStringAsync());
        var hennaProgramId = hennaModeBody.RootElement.GetProperty("programId").GetGuid();
        Assert.Equal(OrganizationAllocationModes.HennaNeedsBased, hennaModeBody.RootElement.GetProperty("allocationMode").GetString());
        Assert.Equal("DRAFT", hennaModeBody.RootElement.GetProperty("state").GetString());
        Assert.Equal(1, hennaModeBody.RootElement.GetProperty("revision").GetInt32());
        Assert.False(hennaModeBody.RootElement.TryGetProperty("balance", out _));
        Assert.False(hennaModeBody.RootElement.TryGetProperty("amount", out _));

        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        var organizationModeKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Add("Idempotency-Key", organizationModeKey.ToString());
        var organizationModeRequest = new { organizationId = orgId, name = "طرح تخصیص سازمان", allocationMode = OrganizationAllocationModes.OrganizationDefined, description = "پیش‌نویس" };
        var organizationModeCreated = await member.PostAsJsonAsync(programsUrl, organizationModeRequest);
        Assert.Equal(HttpStatusCode.Created, organizationModeCreated.StatusCode);
        var changedReplay = await member.PostAsJsonAsync(programsUrl, new { organizationId = orgId, name = "طرح تخصیص سازمان", allocationMode = OrganizationAllocationModes.HennaNeedsBased, description = "پیش‌نویس" });
        Assert.Equal(HttpStatusCode.Conflict, changedReplay.StatusCode);
        using var organizationModeBody = JsonDocument.Parse(await organizationModeCreated.Content.ReadAsStringAsync());
        var organizationProgramId = organizationModeBody.RootElement.GetProperty("programId").GetGuid();
        Assert.Equal(OrganizationAllocationModes.OrganizationDefined, organizationModeBody.RootElement.GetProperty("allocationMode").GetString());

        var provinceId = Guid.NewGuid();
        var cityId = Guid.NewGuid();
        var geographySuffix = Guid.NewGuid().ToString("N");
        geography.Provinces.Add(new ProvinceRecord { Id = provinceId, Name = "استان آزمون", Slug = "test-province-" + geographySuffix, State = GeographyStates.Selectable });
        geography.Cities.Add(new CityRecord { Id = cityId, ProvinceId = provinceId, Name = "شهر آزمون", Slug = "test-city-" + geographySuffix, State = GeographyStates.Selectable });
        await geography.SaveChangesAsync();
        var referralUrl = $"{programsUrl}/{organizationProgramId}/household-referrals";
        var referralBody = new
        {
            programRevision = 1, externalReference = "CASE-1405-001", provinceId, cityId, settlementType = OrganizationSettlementTypes.Urban,
            members = new[]
            {
                new { genderCategory = OrganizationHouseholdCategories.Female, lifeStage = OrganizationHouseholdCategories.OlderAdult, educationLevel = OrganizationHouseholdCategories.EducationNotReported, healthNeed = OrganizationHouseholdCategories.ChronicNeed },
                new { genderCategory = OrganizationHouseholdCategories.Male, lifeStage = OrganizationHouseholdCategories.SchoolAge, educationLevel = OrganizationHouseholdCategories.Primary, healthNeed = OrganizationHouseholdCategories.HealthNotReported }
            }
        };
        var referralKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", referralKey.ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync(referralUrl)).StatusCode);
        unrelated.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.PostAsJsonAsync(referralUrl, referralBody)).StatusCode);
        unrelated.DefaultRequestHeaders.Remove("Idempotency-Key");
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync(referralUrl, new { programRevision = 2, externalReference = "OLD-REV", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "BAD-CITY", referralBody.provinceId, cityId = Guid.NewGuid(), referralBody.settlementType, referralBody.members })).StatusCode);
        var referral = await member.PostAsJsonAsync(referralUrl, referralBody);
        Assert.Equal(HttpStatusCode.Created, referral.StatusCode);
        Assert.Equal("no-store", referral.Headers.GetValues("Cache-Control").Single());
        var referralRetry = await member.PostAsJsonAsync(referralUrl, referralBody);
        Assert.Equal(HttpStatusCode.OK, referralRetry.StatusCode);
        using var referralJson = JsonDocument.Parse(await referral.Content.ReadAsStringAsync());
        using var referralRetryJson = JsonDocument.Parse(await referralRetry.Content.ReadAsStringAsync());
        var referralId = referralJson.RootElement.GetProperty("referralId").GetGuid();
        Assert.Equal(referralId, referralRetryJson.RootElement.GetProperty("referralId").GetGuid());
        Assert.Equal(2, referralJson.RootElement.GetProperty("members").GetArrayLength());
        Assert.False(referralJson.RootElement.TryGetProperty("eligible", out _));
        Assert.False(referralJson.RootElement.TryGetProperty("amount", out _));
        Assert.False(referralJson.RootElement.TryGetProperty("allocation", out _));
        var mismatchedRetry = await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "CASE-1405-002", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.members });
        Assert.Equal(HttpStatusCode.Conflict, mismatchedRetry.StatusCode);
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync(referralUrl, referralBody)).StatusCode);
        var referralRead = await member.GetAsync(referralUrl);
        Assert.Equal(HttpStatusCode.OK, referralRead.StatusCode);
        using var referralListJson = JsonDocument.Parse(await referralRead.Content.ReadAsStringAsync());
        Assert.Contains(referralListJson.RootElement.GetProperty("referrals").EnumerateArray(), item => item.GetProperty("referralId").GetGuid() == referralId);

        var storedReferral = await organizations.HouseholdReferrals.SingleAsync(x => x.Id == referralId);
        var storedMembers = await organizations.HouseholdMembers.Where(x => x.HouseholdReferralId == referralId).OrderBy(x => x.MemberNumber).ToListAsync();
        Assert.Equal("CASE-1405-001", storedReferral.ExternalReference);
        Assert.Equal(2, storedMembers.Count);
        Assert.Contains(storedMembers, x => x.HealthNeed == OrganizationHouseholdCategories.ChronicNeed);
        Assert.False(await identity.RoleAssignments.AnyAsync(x => x.AccountId == memberId));

        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        var listedPrograms = await member.GetAsync(programsUrl);
        Assert.Equal(HttpStatusCode.OK, listedPrograms.StatusCode);
        using var listedBody = JsonDocument.Parse(await listedPrograms.Content.ReadAsStringAsync());
        var programs = listedBody.RootElement.GetProperty("programs").EnumerateArray().ToArray();
        Assert.Equal(2, programs.Length);
        Assert.All(programs, item => Assert.Equal(orgId, item.GetProperty("organizationId").GetGuid()));

        unrelated.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var technicalOperatorCreate = await unrelated.PostAsJsonAsync(programsUrl, new { organizationId = orgId, name = "اپراتور مجاز نیست", allocationMode = OrganizationAllocationModes.HennaNeedsBased, description = "پیش‌نویس" });
        Assert.Equal(HttpStatusCode.Forbidden, technicalOperatorCreate.StatusCode);

        const string fundingInstructionSuffix = "/funding-instruction";
        var instructionUrl = $"{programsUrl}/{hennaProgramId}{fundingInstructionSuffix}";
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync(instructionUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.PostAsJsonAsync(instructionUrl, new { programRevision = 1, sourceInstructionReference = "OUTSIDE-1" })).StatusCode);

        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync(instructionUrl, new { programRevision = 2, sourceInstructionReference = "ORG-INSTRUCTION-1405-01" })).StatusCode);
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(instructionUrl, new { programRevision = 1, sourceInstructionReference = "  " })).StatusCode);
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        var hennaInstructionKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Add("Idempotency-Key", hennaInstructionKey.ToString());
        var hennaInstructionRequest = new { programRevision = 1, sourceInstructionReference = "ORG-INSTRUCTION-1405-01" };
        var hennaInstruction = await member.PostAsJsonAsync(instructionUrl, hennaInstructionRequest);
        Assert.Equal(HttpStatusCode.Created, hennaInstruction.StatusCode);
        Assert.Equal("no-store", hennaInstruction.Headers.GetValues("Cache-Control").Single());
        var hennaInstructionReplay = await member.PostAsJsonAsync(instructionUrl, hennaInstructionRequest);
        Assert.Equal(HttpStatusCode.OK, hennaInstructionReplay.StatusCode);
        using var hennaInstructionBody = JsonDocument.Parse(await hennaInstruction.Content.ReadAsStringAsync());
        using var hennaInstructionReplayBody = JsonDocument.Parse(await hennaInstructionReplay.Content.ReadAsStringAsync());
        var instructionId = hennaInstructionBody.RootElement.GetProperty("instructionId").GetGuid();
        Assert.Equal(instructionId, hennaInstructionReplayBody.RootElement.GetProperty("instructionId").GetGuid());
        Assert.Equal(OrganizationAllocationModes.HennaNeedsBased, hennaInstructionBody.RootElement.GetProperty("allocationMode").GetString());
        Assert.Equal("PENDING_VERIFICATION", hennaInstructionBody.RootElement.GetProperty("state").GetString());
        Assert.False(hennaInstructionBody.RootElement.TryGetProperty("amount", out _));
        Assert.False(hennaInstructionBody.RootElement.TryGetProperty("balance", out _));
        var changedInstructionReplay = await member.PostAsJsonAsync(instructionUrl, new { programRevision = 1, sourceInstructionReference = "ORG-INSTRUCTION-CHANGED" });
        Assert.Equal(HttpStatusCode.Conflict, changedInstructionReplay.StatusCode);
        var readInstructionResponse = await member.GetAsync(instructionUrl);
        Assert.Equal("no-store", readInstructionResponse.Headers.GetValues("Cache-Control").Single());
        using var readInstruction = JsonDocument.Parse(await readInstructionResponse.Content.ReadAsStringAsync());
        Assert.Equal(instructionId, readInstruction.RootElement.GetProperty("instructionId").GetGuid());

        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync(instructionUrl,
            new { programRevision = 1, sourceInstructionReference = "ORG-INSTRUCTION-DUPLICATE" })).StatusCode);

        var organizationInstructionUrl = $"{programsUrl}/{organizationProgramId}{fundingInstructionSuffix}";
        unrelated.DefaultRequestHeaders.Remove("Idempotency-Key");
        unrelated.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.PostAsJsonAsync(organizationInstructionUrl, new { programRevision = 1, sourceInstructionReference = "TECH-OP-1" })).StatusCode);
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var organizationInstruction = await member.PostAsJsonAsync(organizationInstructionUrl, new
        {
            programRevision = 1, sourceInstructionReference = "ORG-INSTRUCTION-1405-02",
            allocationMode = OrganizationAllocationModes.HennaNeedsBased, amount = 99_000_000
        });
        Assert.Equal(HttpStatusCode.Created, organizationInstruction.StatusCode);
        using var organizationInstructionBody = JsonDocument.Parse(await organizationInstruction.Content.ReadAsStringAsync());
        Assert.Equal(OrganizationAllocationModes.OrganizationDefined, organizationInstructionBody.RootElement.GetProperty("allocationMode").GetString());
        Assert.False(organizationInstructionBody.RootElement.TryGetProperty("amount", out _));
        var organizationInstructionId = organizationInstructionBody.RootElement.GetProperty("instructionId").GetGuid();
        const string adminFundingInstructionsUrl = "/api/v1/admin/organization-funding-instructions";
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync(adminFundingInstructionsUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync($"{adminFundingInstructionsUrl}/{organizationInstructionId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"{adminFundingInstructionsUrl}?state=UNKNOWN")).StatusCode);
        var fundingQueue = await admin.GetAsync($"{adminFundingInstructionsUrl}?page=1&pageSize=10&state=PENDING_VERIFICATION");
        Assert.Equal(HttpStatusCode.OK, fundingQueue.StatusCode);
        Assert.Equal("no-store", fundingQueue.Headers.GetValues("Cache-Control").Single());
        using var fundingQueueBody = JsonDocument.Parse(await fundingQueue.Content.ReadAsStringAsync());
        Assert.Equal(2, fundingQueueBody.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(2, fundingQueueBody.RootElement.GetProperty("items").GetArrayLength());
        var queuedInstruction = Assert.Single(fundingQueueBody.RootElement.GetProperty("items").EnumerateArray(), item =>
            item.GetProperty("instructionId").GetGuid() == organizationInstructionId);
        Assert.Equal("سازمان آزمایش", queuedInstruction.GetProperty("organizationName").GetString());
        Assert.Equal("طرح تخصیص سازمان", queuedInstruction.GetProperty("programName").GetString());
        Assert.False(queuedInstruction.TryGetProperty("amount", out _));
        Assert.False(queuedInstruction.TryGetProperty("balance", out _));
        var fundingDetail = await admin.GetAsync($"{adminFundingInstructionsUrl}/{organizationInstructionId}");
        Assert.Equal(HttpStatusCode.OK, fundingDetail.StatusCode);
        Assert.Equal("no-store", fundingDetail.Headers.GetValues("Cache-Control").Single());
        using var fundingDetailBody = JsonDocument.Parse(await fundingDetail.Content.ReadAsStringAsync());
        Assert.Equal(organizationInstructionId, fundingDetailBody.RootElement.GetProperty("instructionId").GetGuid());
        Assert.Equal("ORG-INSTRUCTION-1405-02", fundingDetailBody.RootElement.GetProperty("sourceInstructionReference").GetString());
        Assert.False(fundingDetailBody.RootElement.TryGetProperty("amount", out _));
        Assert.False(fundingDetailBody.RootElement.TryGetProperty("balance", out _));
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"{adminFundingInstructionsUrl}/{organizationInstructionId}?debug=true")).StatusCode);
        var reviewUrl = $"/api/v1/admin/organization-funding-instructions/{organizationInstructionId}/review";
        var reviewReadUrl = $"/api/v1/admin/organization-funding-instructions/{organizationInstructionId}/events";
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync(reviewUrl,
            new { revision = 1, decision = "REJECTED", reason = "مرجع نامعتبر" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(reviewUrl,
            new { revision = 1, decision = "REJECTED", reason = " " })).StatusCode);
        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        var rejectKey = Guid.NewGuid();
        admin.DefaultRequestHeaders.Add("Idempotency-Key", rejectKey.ToString());
        var rejected = await admin.PostAsJsonAsync(reviewUrl,
            new { revision = 1, decision = "REJECTED", reason = "مرجع نیاز به اصلاح دارد" });
        Assert.Equal(HttpStatusCode.Created, rejected.StatusCode);
        var rejectedRetry = await admin.PostAsJsonAsync(reviewUrl,
            new { revision = 1, decision = "REJECTED", reason = "مرجع نیاز به اصلاح دارد" });
        Assert.Equal(HttpStatusCode.OK, rejectedRetry.StatusCode);

        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        var resubmitKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Add("Idempotency-Key", resubmitKey.ToString());
        const string correctedReference = "ORG-INSTRUCTION-1405-02-CORRECTED";
        var resubmitted = await member.PutAsJsonAsync(
            $"/api/v1/organization/programs/{organizationProgramId}/funding-instruction",
            new { revision = 2, sourceInstructionReference = correctedReference });
        Assert.Equal(HttpStatusCode.OK, resubmitted.StatusCode);
        using var resubmittedBody = JsonDocument.Parse(await resubmitted.Content.ReadAsStringAsync());
        Assert.Equal("PENDING_VERIFICATION", resubmittedBody.RootElement.GetProperty("state").GetString());
        Assert.Equal(3, resubmittedBody.RootElement.GetProperty("revision").GetInt32());
        var resubmittedRetry = await member.PutAsJsonAsync(
            $"/api/v1/organization/programs/{organizationProgramId}/funding-instruction",
            new { revision = 2, sourceInstructionReference = correctedReference });
        Assert.Equal(HttpStatusCode.OK, resubmittedRetry.StatusCode);

        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        var verifyKey = Guid.NewGuid();
        admin.DefaultRequestHeaders.Add("Idempotency-Key", verifyKey.ToString());
        var verified = await admin.PostAsJsonAsync(reviewUrl,
            new { revision = 3, decision = "VERIFIED", reason = (string?)null });
        Assert.Equal(HttpStatusCode.Created, verified.StatusCode);
        using var verifiedBody = JsonDocument.Parse(await verified.Content.ReadAsStringAsync());
        Assert.Equal("VERIFIED", verifiedBody.RootElement.GetProperty("decision").GetString());
        Assert.Equal(4, verifiedBody.RootElement.GetProperty("revision").GetInt32());
        admin.DefaultRequestHeaders.Remove("Idempotency-Key");
        admin.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var staleDecision = await admin.PostAsJsonAsync(reviewUrl,
            new { revision = 3, decision = "REJECTED", reason = "stale" });
        Assert.Equal(HttpStatusCode.Conflict, staleDecision.StatusCode);
        var reviewHistory = await admin.GetAsync(reviewReadUrl);
        Assert.Equal(HttpStatusCode.OK, reviewHistory.StatusCode);
        using var historyBody = JsonDocument.Parse(await reviewHistory.Content.ReadAsStringAsync());
        Assert.Equal(3, historyBody.RootElement.GetProperty("events").GetArrayLength());
        var verifiedQueue = await admin.GetAsync($"{adminFundingInstructionsUrl}?state=VERIFIED");
        Assert.Equal(HttpStatusCode.OK, verifiedQueue.StatusCode);
        using var verifiedQueueBody = JsonDocument.Parse(await verifiedQueue.Content.ReadAsStringAsync());
        Assert.Contains(verifiedQueueBody.RootElement.GetProperty("items").EnumerateArray(), item =>
            item.GetProperty("instructionId").GetGuid() == organizationInstructionId &&
            item.GetProperty("state").GetString() == "VERIFIED");
        var finalFundingDetail = await admin.GetAsync($"{adminFundingInstructionsUrl}/{organizationInstructionId}");
        using var finalFundingDetailBody = JsonDocument.Parse(await finalFundingDetail.Content.ReadAsStringAsync());
        Assert.Equal("VERIFIED", finalFundingDetailBody.RootElement.GetProperty("state").GetString());
        var finalInstruction = await organizations.FundingInstructions.SingleAsync(x => x.Id == organizationInstructionId);
        Assert.Equal("VERIFIED", finalInstruction.State);
        Assert.Equal(4, finalInstruction.Revision);
        Assert.Equal(adminId, finalInstruction.ReviewedByAccountId);
        Assert.Equal("مرجع نیاز به اصلاح دارد", organizations.FundingInstructionEvents
            .Where(x => x.FundingInstructionId == organizationInstructionId && x.EventType == "REJECTED")
            .Select(x => x.Reason).Single());

        var storedInstructions = await organizations.FundingInstructions.OrderBy(x => x.ProgramId).ToListAsync();
        Assert.Equal(2, storedInstructions.Count);
        Assert.Contains(storedInstructions, item => item.ProgramId == hennaProgramId && item.AllocationMode == OrganizationAllocationModes.HennaNeedsBased && item.State == "PENDING_VERIFICATION");
        Assert.Contains(storedInstructions, item => item.ProgramId == organizationProgramId && item.AllocationMode == OrganizationAllocationModes.OrganizationDefined && item.State == "VERIFIED" && item.Revision == 4);

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
