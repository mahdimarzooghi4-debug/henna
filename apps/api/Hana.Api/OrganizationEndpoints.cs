using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Domain.Money;
using Hana.Infrastructure.Geography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationEndpoints
{
    private static readonly string[] Roles =
    [OrganizationRoles.Lead, OrganizationRoles.Representative, OrganizationRoles.TechnicalOperator];

    internal static void MapOrganization(this WebApplication app, bool hasDatabase)
    {
        app.MapPost("/api/v1/admin/organizations", async (
            ProvisionOrganizationInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            var name = input.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name) || name.Length > 160 || input.InitialAccountId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["organization"] = ["اطلاعات سازمان معتبر نیست."] });
            if (!Roles.Contains(input.Role, StringComparer.Ordinal) || !Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["نقش یا کلید درخواست معتبر نیست."] });

            try
            {
                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                if (!await identity.Accounts.AnyAsync(x => x.Id == input.InitialAccountId, cancellationToken))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["accountId"] = ["حساب کاربری پیدا نشد."] });
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var prior = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                {
                    var priorMembership = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.GrantKey == key, cancellationToken);
                    if (prior.CreatedByAccountId != auth.AccountId || prior.Name != name || priorMembership is null || priorMembership.OrganizationId != prior.Id || priorMembership.AccountId != input.InitialAccountId || priorMembership.Role != input.Role) return Results.Conflict();
                    return Results.Ok(new { organizationId = prior.Id, name = prior.Name, createdAtUtc = prior.CreatedAtUtc });
                }

                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                var organization = new OrganizationRecord { Id = Guid.NewGuid(), Name = name, CreatedAtUtc = now, CreatedByAccountId = auth.AccountId!.Value, CreationKey = key };
                db.Organizations.Add(organization);
                db.Memberships.Add(new OrganizationMembershipRecord
                {
                    Id = Guid.NewGuid(), OrganizationId = organization.Id, AccountId = input.InitialAccountId,
                    Role = input.Role, GrantedByAccountId = auth.AccountId.Value, GrantedAtUtc = now, GrantKey = key
                });
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/admin/organizations/{organization.Id}", new { organizationId = organization.Id, name, createdAtUtc = now });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("ProvisionOrganization");

        app.MapPost("/api/v1/admin/organizations/{organizationId:guid}/memberships", async (
            Guid organizationId, GrantOrganizationMembershipInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (input.AccountId == Guid.Empty || !Roles.Contains(input.Role, StringComparer.Ordinal)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["membership"] = ["حساب یا نقش معتبر نیست."] });
            try
            {
                var identity = services.GetRequiredService<HanaIdentityDbContext>();
                if (!await identity.Accounts.AnyAsync(x => x.Id == input.AccountId, cancellationToken)) return Results.NotFound();
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                if (!await db.Organizations.AnyAsync(x => x.Id == organizationId, cancellationToken)) return Results.NotFound();
                if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var grantKey) || grantKey == Guid.Empty) return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید درخواست معتبر نیست."] });
                var priorGrant = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.GrantKey == grantKey, cancellationToken);
                if (priorGrant is not null)
                {
                    if (priorGrant.OrganizationId != organizationId || priorGrant.AccountId != input.AccountId || priorGrant.Role != input.Role || priorGrant.GrantedByAccountId != auth.AccountId) return Results.Conflict();
                    return Results.Ok(new { membershipId = priorGrant.Id, priorGrant.OrganizationId, priorGrant.AccountId, priorGrant.Role, priorGrant.GrantedAtUtc });
                }
                if (await db.Memberships.AnyAsync(x => x.OrganizationId == organizationId && x.AccountId == input.AccountId && x.RevokedAtUtc == null, cancellationToken)) return Results.Conflict();
                var record = new OrganizationMembershipRecord { Id = Guid.NewGuid(), OrganizationId = organizationId, AccountId = input.AccountId, Role = input.Role, GrantedByAccountId = auth.AccountId!.Value, GrantedAtUtc = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime(), GrantKey = grantKey };
                db.Memberships.Add(record);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/admin/organizations/{organizationId}/memberships/{record.Id}", new { membershipId = record.Id, record.OrganizationId, record.AccountId, record.Role, record.GrantedAtUtc });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("GrantOrganizationMembership");

        app.MapDelete("/api/v1/admin/organizations/{organizationId:guid}/memberships/{membershipId:guid}", async (
            Guid organizationId, Guid membershipId, int revision, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (revision != 1) return Results.ValidationProblem(new Dictionary<string, string[]> { ["revision"] = ["نسخه عضویت معتبر نیست."] });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var revokeKey) || revokeKey == Guid.Empty) return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید درخواست معتبر نیست."] });
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var changed = await db.Memberships.Where(x => x.Id == membershipId && x.OrganizationId == organizationId && x.RevokedAtUtc == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAtUtc, services.GetRequiredService<IClock>().UtcNow.ToUniversalTime()).SetProperty(x => x.RevokedByAccountId, auth.AccountId).SetProperty(x => x.RevokeKey, revokeKey), cancellationToken);
                if (changed == 1) return Results.NoContent();
                var current = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.Id == membershipId && x.OrganizationId == organizationId, cancellationToken);
                if (current is null) return Results.NotFound();
                return current.RevokeKey == revokeKey && current.RevokedByAccountId == auth.AccountId ? Results.NoContent() : Results.Conflict(new { current.RevokedAtUtc });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("RevokeOrganizationMembership");

        app.MapGet("/api/v1/organization/profiles", async (HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var token = BearerToken(context);
            if (token is null) return Results.Unauthorized();
            if (!hasDatabase) return Results.StatusCode(503);
            try
            {
                var sessions = services.GetRequiredService<AuthSessionService>();
                var accountId = await sessions.ResolveAccountAsync(token, cancellationToken);
                if (accountId is null) return Results.Unauthorized();
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var profiles = await (from membership in db.Memberships.AsNoTracking()
                    join organization in db.Organizations.AsNoTracking() on membership.OrganizationId equals organization.Id
                    where membership.AccountId == accountId.Value && membership.RevokedAtUtc == null
                    orderby organization.Name
                    select new { organizationId = organization.Id, organizationName = organization.Name, memberRole = membership.Role, membershipId = membership.Id }).ToListAsync(cancellationToken);
                return profiles.Count == 0 ? Results.StatusCode(403) : Results.Ok(new { profiles });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("GetOrganizationProfiles");

        app.MapGet("/api/v1/organization/programs", async (HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var programs = await (from membership in db.Memberships.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on membership.OrganizationId equals program.OrganizationId
                    join organization in db.Organizations.AsNoTracking() on program.OrganizationId equals organization.Id
                    where membership.AccountId == account.AccountId && membership.RevokedAtUtc == null
                    orderby program.CreatedAtUtc descending, program.Id
                    select new
                    {
                        programId = program.Id,
                        organizationId = organization.Id,
                        organizationName = organization.Name,
                        name = program.Name,
                        allocationMode = program.AllocationMode,
                        description = program.Description,
                        state = program.State,
                        revision = program.Revision,
                        createdAtUtc = program.CreatedAtUtc
                    }).Take(200).ToListAsync(cancellationToken);
                return Results.Ok(new { programs });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("GetOrganizationPrograms");

        app.MapPost("/api/v1/organization/programs", async (
            OrganizationProgramInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            var name = input.Name?.Trim();
            var description = input.Description?.Trim() ?? string.Empty;
            if (input.OrganizationId == Guid.Empty || string.IsNullOrWhiteSpace(name) || name.Length > 120 || description.Length > 1200 ||
                input.AllocationMode is not (OrganizationAllocationModes.HennaNeedsBased or OrganizationAllocationModes.OrganizationDefined))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["program"] = ["مشخصات طرح یا روش تخصیص معتبر نیست."] });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید یکتای درخواست معتبر نیست."] });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var membership = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x =>
                    x.OrganizationId == input.OrganizationId && x.AccountId == account.AccountId && x.RevokedAtUtc == null, cancellationToken);
                if (membership is null) return Results.StatusCode(StatusCodes.Status403Forbidden);
                if (membership.Role == OrganizationRoles.TechnicalOperator) return Results.StatusCode(403);

                var prior = await db.Programs.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                {
                    if (prior.CreatedByAccountId != account.AccountId || prior.OrganizationId != input.OrganizationId || prior.Name != name ||
                        prior.AllocationMode != input.AllocationMode || prior.Description != description) return Results.Conflict();
                    return Results.Ok(ProgramProjection(prior, membership.OrganizationId));
                }

                var record = new OrganizationProgramRecord
                {
                    Id = Guid.NewGuid(), OrganizationId = membership.OrganizationId, Name = name,
                    AllocationMode = input.AllocationMode, Description = description, State = "DRAFT", Revision = 1,
                    CreatedAtUtc = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime(),
                    CreatedByAccountId = account.AccountId!.Value, CreationKey = key
                };
                db.Programs.Add(record);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/organization/programs/{record.Id}", ProgramProjection(record, membership.OrganizationId));
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("CreateOrganizationProgramDraft");

        app.MapGet("/api/v1/organization/programs/{programId:guid}/funding-instruction", async (
            Guid programId, HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var instruction = await (from membership in db.Memberships.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on membership.OrganizationId equals program.OrganizationId
                    join item in db.FundingInstructions.AsNoTracking() on program.Id equals item.ProgramId
                    where membership.AccountId == account.AccountId && membership.RevokedAtUtc == null && program.Id == programId
                    select item).SingleOrDefaultAsync(cancellationToken);
                return instruction is null ? Results.NotFound() : Results.Ok(FundingInstructionProjection(instruction));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("GetOrganizationProgramFundingInstruction");

        app.MapPost("/api/v1/organization/programs/{programId:guid}/funding-instruction", async (
            Guid programId, OrganizationFundingInstructionInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            var reference = input.SourceInstructionReference?.Trim();
            if (programId == Guid.Empty || input.ProgramRevision < 1 || string.IsNullOrWhiteSpace(reference) ||
                reference.Length > 160 || reference.Any(char.IsControl))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["fundingInstruction"] = ["ارجاع دستور تأمین مالی یا نسخهٔ طرح معتبر نیست."]
                });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید یکتای درخواست معتبر نیست."] });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var access = await (from membership in db.Memberships.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on membership.OrganizationId equals program.OrganizationId
                    where membership.AccountId == account.AccountId && membership.RevokedAtUtc == null && program.Id == programId
                    select new { Program = program, membership.Role }).SingleOrDefaultAsync(cancellationToken);
                if (access is null) return Results.NotFound();
                if (access.Role == OrganizationRoles.TechnicalOperator) return Results.StatusCode(403);
                if (access.Program.State != "DRAFT" || access.Program.Revision != input.ProgramRevision) return Results.Conflict();

                var prior = await db.FundingInstructions.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                {
                    if (prior.ProgramId != programId || prior.ProgramRevision != input.ProgramRevision ||
                        prior.SourceInstructionReference != reference || prior.SubmittedByAccountId != account.AccountId)
                        return Results.Conflict();
                    return Results.Ok(FundingInstructionProjection(prior));
                }
                if (await db.FundingInstructions.AnyAsync(x => x.ProgramId == programId, cancellationToken))
                    return Results.Conflict();

                var record = new OrganizationFundingInstructionRecord
                {
                    Id = Guid.NewGuid(), ProgramId = programId, ProgramRevision = access.Program.Revision,
                    AllocationMode = access.Program.AllocationMode, SourceInstructionReference = reference,
                    State = "PENDING_VERIFICATION", Revision = 1,
                    SubmittedAtUtc = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime(),
                    SubmittedByAccountId = account.AccountId!.Value, CreationKey = key
                };
                db.FundingInstructions.Add(record);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/organization/programs/{programId}/funding-instruction", FundingInstructionProjection(record));
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("SubmitOrganizationProgramFundingInstruction");

        app.MapGet("/api/v1/organization/programs/{programId:guid}/household-referrals", async (
            Guid programId, HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var program = await db.Programs.AsNoTracking().SingleOrDefaultAsync(p => p.Id == programId, cancellationToken);
                if (program is null) return Results.NotFound();
                if (!await db.Memberships.AsNoTracking().AnyAsync(m => m.OrganizationId == program.OrganizationId && m.AccountId == account.AccountId && m.RevokedAtUtc == null, cancellationToken)) return Results.NotFound();
                var referrals = await db.HouseholdReferrals.AsNoTracking().Where(x => x.ProgramId == programId)
                    .OrderByDescending(x => x.SubmittedAtUtc).ThenBy(x => x.Id).Take(500).ToListAsync(cancellationToken);
                var ids = referrals.Select(x => x.Id).ToArray();
                var members = await db.HouseholdMembers.AsNoTracking().Where(x => ids.Contains(x.HouseholdReferralId))
                    .OrderBy(x => x.MemberNumber).ToListAsync(cancellationToken);
                return Results.Ok(new { referrals = referrals.Select(x => HouseholdReferralProjection(x, members.Where(m => m.HouseholdReferralId == x.Id).ToList())) });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("GetOrganizationHouseholdReferrals");

        app.MapPost("/api/v1/organization/programs/{programId:guid}/household-referrals", async (
            Guid programId, OrganizationHouseholdReferralInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            var reference = input.ExternalReference?.Trim();
            if (programId == Guid.Empty || input.ProgramRevision < 1 || string.IsNullOrWhiteSpace(reference) || reference.Length > 120 || reference.Any(char.IsControl) ||
                input.ProvinceId == Guid.Empty || input.CityId == Guid.Empty || input.SettlementType is not (OrganizationSettlementTypes.Urban or OrganizationSettlementTypes.Rural) ||
                input.HousingTenure is not (OrganizationHousingTenureTypes.Owner or OrganizationHousingTenureTypes.Tenant) ||
                input.HealthBurdenLevel is not (OrganizationAllocationAssessmentTypes.HealthNone or OrganizationAllocationAssessmentTypes.HealthOneManageable or OrganizationAllocationAssessmentTypes.HealthHighBurden or OrganizationAllocationAssessmentTypes.HealthSevere) ||
                input.EconomicHardshipLevel is not (OrganizationAllocationAssessmentTypes.HardshipNeedsMet or OrganizationAllocationAssessmentTypes.HardshipOccasionalShortfall or OrganizationAllocationAssessmentTypes.HardshipRecurrentShortfall or OrganizationAllocationAssessmentTypes.HardshipMultipleUnmet) ||
                input.CareSupportLevel is not (OrganizationAllocationAssessmentTypes.CareSupportAvailable or OrganizationAllocationAssessmentTypes.OneAdultNoDependents or OrganizationAllocationAssessmentTypes.LoneCaregiverOneDependent or OrganizationAllocationAssessmentTypes.NoPracticalSupport) ||
                input.EducationAttainment is not (OrganizationAllocationAssessmentTypes.EducationBachelorOrHigher or OrganizationAllocationAssessmentTypes.EducationDiplomaOrAssociate or OrganizationAllocationAssessmentTypes.EducationBelowDiploma or OrganizationAllocationAssessmentTypes.EducationNoFormalOrLiteracy) ||
                input.SettlementType == OrganizationSettlementTypes.Urban && input.CityId is null ||
                input.Members is null || input.Members.Count is < 1 or > 20 || input.Members.Any(m => m is null ||
                    !Allowed(m.GenderCategory, OrganizationHouseholdCategories.Female, OrganizationHouseholdCategories.Male, OrganizationHouseholdCategories.NotReported) ||
                    !Allowed(m.LifeStage, OrganizationHouseholdCategories.Infant, OrganizationHouseholdCategories.Preschool, OrganizationHouseholdCategories.SchoolAge, OrganizationHouseholdCategories.Adult, OrganizationHouseholdCategories.OlderAdult) ||
                    !Allowed(m.EducationLevel, OrganizationHouseholdCategories.NoFormalEducation, OrganizationHouseholdCategories.Primary, OrganizationHouseholdCategories.Secondary, OrganizationHouseholdCategories.Diploma, OrganizationHouseholdCategories.HigherEducation, OrganizationHouseholdCategories.EducationNotReported) ||
                    !Allowed(m.HealthNeed, OrganizationHouseholdCategories.NoKnownChronicNeed, OrganizationHouseholdCategories.ChronicNeed, OrganizationHouseholdCategories.HealthNotReported) ||
                    m.NeedsPracticalSupport is null || m.LifeStage != OrganizationHouseholdCategories.OlderAdult && m.NeedsPracticalSupport.Value))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["referral"] = ["ارجاع خانوار یا دسته‌بندی اعضا معتبر نیست."] });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید یکتای درخواست معتبر نیست."] });
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var program = await db.Programs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == programId, cancellationToken);
                if (program is null) return Results.NotFound();
                var membership = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == program.OrganizationId && x.AccountId == account.AccountId && x.RevokedAtUtc == null, cancellationToken);
                if (membership is null) return Results.NotFound();
                if (membership.Role == OrganizationRoles.TechnicalOperator) return Results.StatusCode(403);
                if (program.State != "DRAFT" || input.ProgramRevision != program.Revision) return Results.Conflict(new { currentRevision = program.Revision });

                var geography = services.GetRequiredService<HanaGeographyDbContext>();
                var provinceSelectable = await geography.Provinces.AsNoTracking().AnyAsync(x => x.Id == input.ProvinceId && x.State == GeographyStates.Selectable, cancellationToken);
                var citySelectable = input.CityId is null || await geography.Cities.AsNoTracking().AnyAsync(x => x.Id == input.CityId && x.ProvinceId == input.ProvinceId && x.State == GeographyStates.Selectable && x.Province.State == GeographyStates.Selectable, cancellationToken);
                if (!provinceSelectable || !citySelectable) return Results.ValidationProblem(new Dictionary<string, string[]> { ["geography"] = ["استان و شهر باید قابل انتخاب باشند و شهر به همان استان تعلق داشته باشد."] });

                var prior = await db.HouseholdReferrals.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                {
                    var priorMembers = await db.HouseholdMembers.AsNoTracking().Where(x => x.HouseholdReferralId == prior.Id).OrderBy(x => x.MemberNumber).ToListAsync(cancellationToken);
                    if (prior.SubmittedByAccountId != account.AccountId || prior.ProgramId != programId || prior.OrganizationId != program.OrganizationId || prior.ExternalReference != reference || prior.ProvinceId != input.ProvinceId || prior.CityId != input.CityId || prior.SettlementType != input.SettlementType || prior.HousingTenure != input.HousingTenure || prior.HealthBurdenLevel != input.HealthBurdenLevel || prior.EconomicHardshipLevel != input.EconomicHardshipLevel || prior.CareSupportLevel != input.CareSupportLevel || prior.EducationAttainment != input.EducationAttainment || !SameMembers(priorMembers, input.Members)) return Results.Conflict();
                    return Results.Ok(HouseholdReferralProjection(prior, priorMembers));
                }
                if (await db.HouseholdReferrals.AnyAsync(x => x.OrganizationId == program.OrganizationId && x.ProgramId == programId && x.ExternalReference == reference, cancellationToken)) return Results.Conflict();
                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                var record = new OrganizationHouseholdReferralRecord { Id = Guid.NewGuid(), OrganizationId = program.OrganizationId, ProgramId = programId, ExternalReference = reference, ProvinceId = input.ProvinceId, CityId = input.CityId, SettlementType = input.SettlementType, HousingTenure = input.HousingTenure, HealthBurdenLevel = input.HealthBurdenLevel, EconomicHardshipLevel = input.EconomicHardshipLevel, CareSupportLevel = input.CareSupportLevel, EducationAttainment = input.EducationAttainment, Revision = 1, SubmittedAtUtc = now, SubmittedByAccountId = account.AccountId!.Value, CreationKey = key };
                var memberRecords = input.Members.Select((m, index) => new OrganizationHouseholdMemberRecord { Id = Guid.NewGuid(), HouseholdReferralId = record.Id, MemberNumber = index + 1, GenderCategory = m.GenderCategory, LifeStage = m.LifeStage, EducationLevel = m.EducationLevel, HealthNeed = m.HealthNeed, NeedsPracticalSupport = m.NeedsPracticalSupport }).ToList();
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                db.HouseholdReferrals.Add(record);
                db.HouseholdMembers.AddRange(memberRecords);
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Results.Created($"/api/v1/organization/programs/{programId}/household-referrals/{record.Id}", HouseholdReferralProjection(record, memberRecords));
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("CreateOrganizationHouseholdReferral");

        app.MapPost("/api/v1/admin/organization/programs/{programId:guid}/allocation-previews", async (
            Guid programId, OrganizationAllocationPreviewInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (programId == Guid.Empty || input.ProgramRevision < 1 || input.Households is null ||
                input.Households.Count is < 1 or > 500 || input.Households.Any(x => x is null || x.ReferralId == Guid.Empty || x.ReferralRevision != 1) ||
                input.Households.Select(x => x.ReferralId).Distinct().Count() != input.Households.Count ||
                !Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["allocationPreview"] = ["درخواست پیش‌نمایش تخصیص معتبر نیست."] });

            string? payloadHash = null;
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var program = await db.Programs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == programId, cancellationToken);
                if (program is null) return Results.NotFound();
                var fundingInstruction = await db.FundingInstructions.AsNoTracking().SingleOrDefaultAsync(x => x.ProgramId == programId, cancellationToken);
                if (fundingInstruction is null || fundingInstruction.State != "VERIFIED" ||
                    fundingInstruction.ProgramRevision != program.Revision || program.State != "DRAFT" ||
                    fundingInstruction.AllocationMode != program.AllocationMode || input.ProgramRevision != program.Revision)
                    return Results.Conflict(new { message = "دستور تأمین مالی قابل بررسی نیست؛ preview فقط روی دستور ثبت‌شده و تأییدشده انجام می‌شود." });

                var isNeedsBased = program.AllocationMode == OrganizationAllocationModes.HennaNeedsBased;
                var isOrganizationDefined = program.AllocationMode == OrganizationAllocationModes.OrganizationDefined;
                var needsBasedAmountsInvalid = input.BaseAmountRials.GetValueOrDefault() <= 0 ||
                    input.CeilingRials.GetValueOrDefault() <= 0 ||
                    input.CeilingRials.GetValueOrDefault() > input.BaseAmountRials.GetValueOrDefault();
                if ((!isNeedsBased && !isOrganizationDefined) ||
                    isNeedsBased && (input.BaseAmountRials is null || input.CeilingRials is null || needsBasedAmountsInvalid || input.Households.Any(x => x.BeneficiaryAmountRials is not null)) ||
                    isOrganizationDefined && (input.BaseAmountRials is not null || input.CeilingRials is not null || input.Households.Any(x => x.BeneficiaryAmountRials is null or <= 0)))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["amounts"] = ["مبالغ باید صریح باشند و با روش تخصیص طرح سازگار باشند."] });

                var mode = isNeedsBased ? CreditAllocationModeV1.NeedsBased : CreditAllocationModeV1.OrganizationDefined;
                var orderedInput = input.Households.OrderBy(x => x.ReferralId).ToArray();
                var hashPayload = JsonSerializer.Serialize(new
                {
                    input.ProgramRevision,
                    program.AllocationMode,
                    fundingInstruction.Id,
                    fundingInstruction.SourceInstructionReference,
                    input.BaseAmountRials,
                    input.CeilingRials,
                    Households = orderedInput.Select(x => new { x.ReferralId, x.ReferralRevision, x.BeneficiaryAmountRials })
                });
                payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(hashPayload))).ToLowerInvariant();
                var prior = await db.AllocationPreviews.AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                if (prior is not null)
                    return prior.CreatedByAccountId == auth.AccountId && prior.ProgramId == programId && prior.PayloadSha256 == payloadHash
                        ? Results.Json(JsonSerializer.Deserialize<JsonElement>(prior.SnapshotJson), statusCode: StatusCodes.Status200OK)
                        : Results.Conflict();

                var referralIds = orderedInput.Select(x => x.ReferralId).ToArray();
                var referrals = await db.HouseholdReferrals.AsNoTracking().Where(x => x.ProgramId == programId && referralIds.Contains(x.Id)).ToListAsync(cancellationToken);
                if (referrals.Count != orderedInput.Length) return Results.ValidationProblem(new Dictionary<string, string[]> { ["households"] = ["همه پرونده‌ها باید متعلق به همین طرح باشند."] });
                var referralById = referrals.ToDictionary(x => x.Id);
                var referralMembers = await db.HouseholdMembers.AsNoTracking().Where(x => referralIds.Contains(x.HouseholdReferralId))
                    .OrderBy(x => x.MemberNumber).ToListAsync(cancellationToken);
                var membersByReferral = referralMembers.GroupBy(x => x.HouseholdReferralId).ToDictionary(x => x.Key, x => (IReadOnlyCollection<OrganizationHouseholdMemberRecord>)x.ToArray());
                var geography = services.GetRequiredService<HanaGeographyDbContext>();
                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                var instruction = new CreditFundingInstructionV1(CreditFundingSourceV1.Organization, mode,
                    fundingInstruction.SourceInstructionReference, fundingInstruction.SourceInstructionReference);
                var calculations = new List<object>(orderedInput.Length);

                foreach (var requested in orderedInput)
                {
                    var referral = referralById[requested.ReferralId];
                    if (referral.Revision != requested.ReferralRevision || !membersByReferral.TryGetValue(referral.Id, out var householdMembers))
                        return Results.Conflict(new { referralId = requested.ReferralId, currentRevision = referral.Revision });
                    var assessment = OrganizationHouseholdAssessmentMapper.Map(referral, householdMembers);
                    var province = await geography.Provinces.AsNoTracking().SingleOrDefaultAsync(x => x.Id == referral.ProvinceId && x.State == GeographyStates.Selectable, cancellationToken);
                    if (province is null) return Results.Conflict(new { referralId = referral.Id, message = "استان دیگر قابل انتخاب نیست." });

                    CreditProgramAllocationV1 allocation;
                    if (isNeedsBased)
                    {
                        if (referral.SettlementType == OrganizationSettlementTypes.Urban)
                        {
                            if (referral.CityId is null) return Results.Conflict(new { referralId = referral.Id, message = "شهر برای پرونده شهری ثبت نشده است." });
                            var city = await geography.Cities.AsNoTracking().Where(x => x.Id == referral.CityId && x.ProvinceId == referral.ProvinceId && x.State == GeographyStates.Selectable && x.Province.State == GeographyStates.Selectable)
                                .Select(x => new { x.Name, ProvinceName = x.Province.Name }).SingleOrDefaultAsync(cancellationToken);
                            if (city is null) return Results.Conflict(new { referralId = referral.Id, message = "شهر دیگر قابل انتخاب نیست یا به استان پرونده تعلق ندارد." });
                            allocation = CreditFundingInstructionResolverV1.CalculateNeedsBasedForCity(instruction,
                                new RialAmount(input.BaseAmountRials!.Value), new RialAmount(input.CeilingRials!.Value),
                                city.ProvinceName, city.Name, assessment);
                        }
                        else if (referral.SettlementType == OrganizationSettlementTypes.Rural && referral.CityId is null)
                        {
                            allocation = CreditFundingInstructionResolverV1.CalculateNeedsBasedForNonCity(instruction,
                                new RialAmount(input.BaseAmountRials!.Value), new RialAmount(input.CeilingRials!.Value),
                                province.Name, assessment);
                        }
                        else return Results.Conflict(new { referralId = referral.Id, message = "نوع سکونت و مکان پرونده با هم سازگار نیستند." });
                    }
                    else
                    {
                        allocation = CreditFundingInstructionResolverV1.CalculateOrganizationDefined(instruction,
                            new RialAmount(requested.BeneficiaryAmountRials!.Value));
                    }

                    var snapshot = CreditAllocationAuditSnapshotV1.Capture(Guid.NewGuid(), now, allocation);
                    calculations.Add(new { referralId = referral.Id, externalReference = referral.ExternalReference, referralRevision = referral.Revision, snapshot });
                }

                var previewId = Guid.NewGuid();
                var snapshotJson = JsonSerializer.Serialize(new
                {
                    allocationPreviewId = previewId,
                    programId,
                    programRevision = program.Revision,
                    fundingInstructionId = fundingInstruction.Id,
                    fundingInstructionState = fundingInstruction.State,
                    state = "PREVIEW_ONLY",
                    allocationMode = program.AllocationMode,
                    createdAtUtc = now,
                    createdByAccountId = auth.AccountId,
                    householdCount = calculations.Count,
                    calculations
                }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                var record = new OrganizationAllocationPreviewRecord
                {
                    Id = previewId, OrganizationId = program.OrganizationId, ProgramId = programId,
                    ProgramRevision = program.Revision, FundingInstructionId = fundingInstruction.Id,
                    AllocationMode = program.AllocationMode, FundingSource = "ORGANIZATION",
                    FundingSourceReference = fundingInstruction.SourceInstructionReference,
                    InstructionReference = fundingInstruction.SourceInstructionReference,
                    FundingInstructionState = fundingInstruction.State, State = "PREVIEW_ONLY",
                    PayloadSha256 = payloadHash, SnapshotJson = snapshotJson, CreatedAtUtc = now,
                    CreatedByAccountId = auth.AccountId!.Value, CreationKey = key
                };
                db.AllocationPreviews.Add(record);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Json(JsonSerializer.Deserialize<JsonElement>(snapshotJson), statusCode: StatusCodes.Status201Created);
            }
            catch (InvalidOperationException ex) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.Conflict(new { message = ex.Message });
            }
            catch (KeyNotFoundException) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.Conflict(new { message = "استان این پرونده در نسخهٔ جاری دادهٔ جغرافیایی محاسبه وجود ندارد." });
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested)
            {
                // A concurrent replay may win the unique creation-key insert.
                // Return that immutable result only when the request is identical.
                var replay = await services.GetRequiredService<HanaOrganizationDbContext>().AllocationPreviews
                    .AsNoTracking().SingleOrDefaultAsync(x => x.CreationKey == key, cancellationToken);
                return replay is not null && replay.CreatedByAccountId == auth.AccountId &&
                    replay.ProgramId == programId && replay.PayloadSha256 == payloadHash
                    ? Results.Json(JsonSerializer.Deserialize<JsonElement>(replay.SnapshotJson), statusCode: StatusCodes.Status200OK)
                    : Results.Conflict();
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("CreateOrganizationAllocationPreview");

        app.MapGet("/api/v1/admin/organization/programs/{programId:guid}/allocation-previews/{previewId:guid}", async (
            Guid programId, Guid previewId, HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var preview = await db.AllocationPreviews.AsNoTracking().SingleOrDefaultAsync(x => x.Id == previewId && x.ProgramId == programId, cancellationToken);
                return preview is null ? Results.NotFound() : Results.Json(JsonSerializer.Deserialize<JsonElement>(preview.SnapshotJson));
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("GetOrganizationAllocationPreview");
    }

    private static async Task<(Guid? AccountId, IResult? Error)> OrganizationAccount(HttpContext context, IServiceProvider services, bool hasDatabase, CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase) return (null, Results.StatusCode(503));
        var accountId = await services.GetRequiredService<AuthSessionService>().ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        try
        {
            var db = services.GetRequiredService<HanaOrganizationDbContext>();
            return await db.Memberships.AsNoTracking().AnyAsync(x => x.AccountId == accountId.Value && x.RevokedAtUtc == null, cancellationToken)
                ? (accountId, null) : (null, Results.StatusCode(403));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested) { return (null, Results.StatusCode(503)); }
    }

    private static object ProgramProjection(OrganizationProgramRecord program, Guid organizationId) => new
    {
        programId = program.Id, organizationId, name = program.Name, allocationMode = program.AllocationMode,
        description = program.Description, state = program.State, revision = program.Revision, createdAtUtc = program.CreatedAtUtc
    };

    private static object FundingInstructionProjection(OrganizationFundingInstructionRecord instruction) => new
    {
        instructionId = instruction.Id, programId = instruction.ProgramId,
        programRevision = instruction.ProgramRevision, allocationMode = instruction.AllocationMode,
        sourceInstructionReference = instruction.SourceInstructionReference, state = instruction.State,
        revision = instruction.Revision, submittedAtUtc = instruction.SubmittedAtUtc,
        reviewReason = instruction.ReviewReason, reviewedAtUtc = instruction.ReviewedAtUtc
    };

    private static object HouseholdReferralProjection(OrganizationHouseholdReferralRecord referral, IReadOnlyCollection<OrganizationHouseholdMemberRecord> members) => new
    {
        referralId = referral.Id, programId = referral.ProgramId, externalReference = referral.ExternalReference,
        provinceId = referral.ProvinceId, cityId = referral.CityId, settlementType = referral.SettlementType, housingTenure = referral.HousingTenure,
        healthBurdenLevel = referral.HealthBurdenLevel, economicHardshipLevel = referral.EconomicHardshipLevel,
        careSupportLevel = referral.CareSupportLevel, educationAttainment = referral.EducationAttainment,
        revision = referral.Revision, submittedAtUtc = referral.SubmittedAtUtc,
        members = members.OrderBy(x => x.MemberNumber).Select(x => new { x.MemberNumber, x.GenderCategory, x.LifeStage, x.EducationLevel, x.HealthNeed, x.NeedsPracticalSupport })
    };

    private static bool Allowed(string value, params string[] allowed) => allowed.Contains(value, StringComparer.Ordinal);

    private static bool SameMembers(IReadOnlyList<OrganizationHouseholdMemberRecord> stored, IReadOnlyList<OrganizationHouseholdMemberInput> requested) =>
        stored.Count == requested.Count && stored.Select((item, index) => item.MemberNumber == index + 1 && item.GenderCategory == requested[index].GenderCategory &&
            item.LifeStage == requested[index].LifeStage && item.EducationLevel == requested[index].EducationLevel && item.HealthNeed == requested[index].HealthNeed && item.NeedsPracticalSupport == requested[index].NeedsPracticalSupport).All(x => x);

    private static async Task<(Guid? AccountId, IResult? Error)> Admin(HttpContext context, IServiceProvider services, bool hasDatabase, CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase) return (null, Results.StatusCode(503));
        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        var roles = services.GetRequiredService<RoleAuthorizationService>();
        return await roles.HasRoleAsync(accountId.Value, HanaRoles.Admin, cancellationToken)
            ? (accountId, null) : (null, Results.StatusCode(403));
    }

    private static string? BearerToken(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var token = header[7..];
        return SessionTokenCodec.TryComputeDigest(token, out _) ? token : null;
    }
}

internal sealed record ProvisionOrganizationInput(string? Name, Guid InitialAccountId, string Role);
internal sealed record GrantOrganizationMembershipInput(Guid AccountId, string Role);
internal sealed record OrganizationProgramInput(Guid OrganizationId, string? Name, string AllocationMode, string? Description);
internal sealed record OrganizationFundingInstructionInput(int ProgramRevision, string? SourceInstructionReference);
internal sealed record OrganizationHouseholdReferralInput(int ProgramRevision, string? ExternalReference, Guid ProvinceId, Guid? CityId, string SettlementType, string? HousingTenure, string? HealthBurdenLevel, string? EconomicHardshipLevel, string? CareSupportLevel, string? EducationAttainment, IReadOnlyList<OrganizationHouseholdMemberInput> Members);
internal sealed record OrganizationHouseholdMemberInput(string GenderCategory, string LifeStage, string EducationLevel, string HealthNeed, bool? NeedsPracticalSupport);
internal sealed record OrganizationAllocationPreviewInput(int ProgramRevision, long? BaseAmountRials, long? CeilingRials, IReadOnlyList<OrganizationAllocationPreviewHouseholdInput> Households);
internal sealed record OrganizationAllocationPreviewHouseholdInput(Guid ReferralId, int ReferralRevision, long? BeneficiaryAmountRials);
