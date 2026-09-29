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
            programRevision = 1, externalReference = "CASE-1405-001", provinceId, cityId, settlementType = OrganizationSettlementTypes.Urban, housingTenure = OrganizationHousingTenureTypes.Tenant,
            healthBurdenLevel = OrganizationAllocationAssessmentTypes.HealthOneManageable,
            economicHardshipLevel = OrganizationAllocationAssessmentTypes.HardshipOccasionalShortfall,
            careSupportLevel = OrganizationAllocationAssessmentTypes.CareSupportAvailable,
            educationAttainment = OrganizationAllocationAssessmentTypes.EducationDiplomaOrAssociate,
            members = new[]
            {
                new { genderCategory = OrganizationHouseholdCategories.Female, lifeStage = OrganizationHouseholdCategories.OlderAdult, educationLevel = OrganizationHouseholdCategories.EducationNotReported, healthNeed = OrganizationHouseholdCategories.ChronicNeed, needsPracticalSupport = true },
                new { genderCategory = OrganizationHouseholdCategories.Male, lifeStage = OrganizationHouseholdCategories.SchoolAge, educationLevel = OrganizationHouseholdCategories.Primary, healthNeed = OrganizationHouseholdCategories.HealthNotReported, needsPracticalSupport = false }
            }
        };
        var referralKey = Guid.NewGuid();
        member.DefaultRequestHeaders.Remove("Idempotency-Key");
        member.DefaultRequestHeaders.Add("Idempotency-Key", referralKey.ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync(referralUrl)).StatusCode);
        unrelated.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await unrelated.PostAsJsonAsync(referralUrl, referralBody)).StatusCode);
        unrelated.DefaultRequestHeaders.Remove("Idempotency-Key");
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync(referralUrl, new { programRevision = 2, externalReference = "OLD-REV", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "BAD-CITY", referralBody.provinceId, cityId = Guid.NewGuid(), referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "MISSING-TENURE", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "BAD-TENURE", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, housingTenure = "UNKNOWN", referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "BAD-CARE", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, careSupportLevel = "UNKNOWN", referralBody.educationAttainment, referralBody.members })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "NON-SENIOR-SUPPORT", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, members = new[] { new { genderCategory = OrganizationHouseholdCategories.Female, lifeStage = OrganizationHouseholdCategories.Adult, educationLevel = OrganizationHouseholdCategories.EducationNotReported, healthNeed = OrganizationHouseholdCategories.HealthNotReported, needsPracticalSupport = true } } })).StatusCode);
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
        Assert.Equal(OrganizationHousingTenureTypes.Tenant, referralJson.RootElement.GetProperty("housingTenure").GetString());
        Assert.Equal(OrganizationAllocationAssessmentTypes.HealthOneManageable, referralJson.RootElement.GetProperty("healthBurdenLevel").GetString());
        Assert.Equal(OrganizationAllocationAssessmentTypes.HardshipOccasionalShortfall, referralJson.RootElement.GetProperty("economicHardshipLevel").GetString());
        Assert.Equal(OrganizationAllocationAssessmentTypes.CareSupportAvailable, referralJson.RootElement.GetProperty("careSupportLevel").GetString());
        Assert.Equal(OrganizationAllocationAssessmentTypes.EducationDiplomaOrAssociate, referralJson.RootElement.GetProperty("educationAttainment").GetString());
        Assert.False(referralJson.RootElement.TryGetProperty("eligible", out _));
        Assert.False(referralJson.RootElement.TryGetProperty("amount", out _));
        Assert.False(referralJson.RootElement.TryGetProperty("allocation", out _));
        var mismatchedRetry = await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, externalReference = "CASE-1405-002", referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members });
        Assert.Equal(HttpStatusCode.Conflict, mismatchedRetry.StatusCode);
        var changedTenureRetry = await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, referralBody.externalReference, referralBody.provinceId, referralBody.cityId, referralBody.settlementType, housingTenure = OrganizationHousingTenureTypes.Owner, referralBody.healthBurdenLevel, referralBody.economicHardshipLevel, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members });
        Assert.Equal(HttpStatusCode.Conflict, changedTenureRetry.StatusCode);
        var changedAssessmentRetry = await member.PostAsJsonAsync(referralUrl, new { referralBody.programRevision, referralBody.externalReference, referralBody.provinceId, referralBody.cityId, referralBody.settlementType, referralBody.housingTenure, referralBody.healthBurdenLevel, economicHardshipLevel = OrganizationAllocationAssessmentTypes.HardshipNeedsMet, referralBody.careSupportLevel, referralBody.educationAttainment, referralBody.members });
        Assert.Equal(HttpStatusCode.Conflict, changedAssessmentRetry.StatusCode);
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
        Assert.Equal(OrganizationHousingTenureTypes.Tenant, storedReferral.HousingTenure);
        Assert.Equal(OrganizationAllocationAssessmentTypes.HealthOneManageable, storedReferral.HealthBurdenLevel);
        Assert.Equal(2, storedMembers.Count);
        Assert.Contains(storedMembers, x => x.HealthNeed == OrganizationHouseholdCategories.ChronicNeed);
        Assert.Contains(storedMembers, x => x.NeedsPracticalSupport == true);
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

        var storedInstructions = await organizations.FundingInstructions.OrderBy(x => x.ProgramId).ToListAsync();
        Assert.Equal(2, storedInstructions.Count);
        Assert.Contains(storedInstructions, item => item.ProgramId == hennaProgramId && item.AllocationMode == OrganizationAllocationModes.HennaNeedsBased && item.State == "PENDING_VERIFICATION");
        Assert.Contains(storedInstructions, item => item.ProgramId == organizationProgramId && item.AllocationMode == OrganizationAllocationModes.OrganizationDefined && item.State == "PENDING_VERIFICATION");

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
