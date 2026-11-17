using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationFundingInstructionReviewEndpoints
{
    internal static void MapOrganizationFundingInstructionReviews(this WebApplication app, bool hasDatabase)
    {
        app.MapGet("/api/v1/admin/organization-funding-instructions", async (
            HttpContext context, IServiceProvider services, int? page, int? pageSize,
            string? state, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            var allowedQuery = new HashSet<string>(StringComparer.Ordinal) { "page", "pageSize", "state" };
            if (context.Request.Query.Keys.Any(key => !allowedQuery.Contains(key)) ||
                context.Request.Query.Any(pair => pair.Value.Count != 1))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["query"] = ["پارامترهای درخواست معتبر نیست."]
                });

            var selectedPage = page ?? 1;
            var selectedPageSize = pageSize ?? 20;
            var selectedState = state?.Trim().ToUpperInvariant() ?? "PENDING_VERIFICATION";
            if (selectedPage is < 1 or > 10_000 || selectedPageSize is < 1 or > 50 ||
                selectedState is not ("ALL" or "PENDING_VERIFICATION" or "VERIFIED" or "REJECTED"))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["query"] = ["فیلتر یا صفحه‌بندی معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var query = from instruction in db.FundingInstructions.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on instruction.ProgramId equals program.Id
                    join organization in db.Organizations.AsNoTracking() on program.OrganizationId equals organization.Id
                    select new { Instruction = instruction, ProgramName = program.Name, OrganizationName = organization.Name };
                if (selectedState != "ALL")
                    query = query.Where(x => x.Instruction.State == selectedState);
                var total = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(x => x.Instruction.SubmittedAtUtc)
                    .ThenBy(x => x.Instruction.Id)
                    .Skip((selectedPage - 1) * selectedPageSize)
                    .Take(selectedPageSize)
                    .Select(x => new
                    {
                        instructionId = x.Instruction.Id,
                        organizationName = x.OrganizationName,
                        programName = x.ProgramName,
                        allocationMode = x.Instruction.AllocationMode,
                        sourceInstructionReference = x.Instruction.SourceInstructionReference,
                        state = x.Instruction.State,
                        revision = x.Instruction.Revision,
                        submittedAtUtc = x.Instruction.SubmittedAtUtc,
                        reviewReason = x.Instruction.ReviewReason,
                        reviewedAtUtc = x.Instruction.ReviewedAtUtc
                    }).ToListAsync(cancellationToken);
                return Results.Ok(new { items, page = selectedPage, pageSize = selectedPageSize, total });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("ListOrganizationFundingInstructions");

        app.MapGet("/api/v1/admin/organization-funding-instructions/{instructionId:guid}", async (
            Guid instructionId, HttpContext context, IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (instructionId == Guid.Empty) return Results.NotFound();
            if (context.Request.Query.Count != 0)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["query"] = ["پارامتر اضافی معتبر نیست."]
                });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var item = await (from instruction in db.FundingInstructions.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on instruction.ProgramId equals program.Id
                    join organization in db.Organizations.AsNoTracking() on program.OrganizationId equals organization.Id
                    where instruction.Id == instructionId
                    select new
                    {
                        instructionId = instruction.Id,
                        programId = instruction.ProgramId,
                        programRevision = instruction.ProgramRevision,
                        organizationName = organization.Name,
                        programName = program.Name,
                        allocationMode = instruction.AllocationMode,
                        sourceInstructionReference = instruction.SourceInstructionReference,
                        state = instruction.State,
                        revision = instruction.Revision,
                        submittedAtUtc = instruction.SubmittedAtUtc,
                        reviewReason = instruction.ReviewReason,
                        reviewedAtUtc = instruction.ReviewedAtUtc
                    }).SingleOrDefaultAsync(cancellationToken);
                if (item is null) return Results.NotFound();
                return Results.Ok(item);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("GetOrganizationFundingInstruction");

        app.MapPost("/api/v1/admin/organization-funding-instructions/{instructionId:guid}/review", async (
            Guid instructionId, FundingInstructionReviewInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;

            var decision = input.Decision?.Trim().ToUpperInvariant();
            var reason = input.Reason?.Trim();
            if (instructionId == Guid.Empty || input.Revision < 1 ||
                decision is not ("VERIFIED" or "REJECTED") ||
                decision == "REJECTED" && string.IsNullOrWhiteSpace(reason) ||
                reason is { Length: > 1000 } || reason?.Any(char.IsControl) == true)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["review"] = ["تصمیم، نسخه یا دلیل بررسی معتبر نیست."]
                });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید یکتای درخواست معتبر نیست."] });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var prior = await db.FundingInstructionEvents.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.IdempotencyKey == key, cancellationToken);
                if (prior is not null)
                {
                    if (prior.FundingInstructionId != instructionId || prior.Revision != input.Revision + 1 ||
                        prior.EventType != decision || prior.Reason != reason || prior.ActorAccountId != auth.AccountId)
                        return Results.Conflict();
                    return Results.Ok(EventProjection(prior));
                }

                var funding = await db.FundingInstructions.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == instructionId, cancellationToken);
                if (funding is null) return Results.NotFound();
                var programIsCurrent = await db.Programs.AsNoTracking().AnyAsync(x =>
                    x.Id == funding.ProgramId && x.State == "DRAFT" && x.Revision == funding.ProgramRevision,
                    cancellationToken);
                if (!programIsCurrent) return Results.Conflict(new { currentRevision = funding.Revision, state = funding.State });

                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                var changed = await db.FundingInstructions
                    .Where(x => x.Id == instructionId && x.State == "PENDING_VERIFICATION" && x.Revision == input.Revision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.State, decision!)
                        .SetProperty(x => x.Revision, x => x.Revision + 1)
                        .SetProperty(x => x.ReviewedByAccountId, auth.AccountId)
                        .SetProperty(x => x.ReviewedAtUtc, now)
                        .SetProperty(x => x.ReviewReason, reason), cancellationToken);
                if (changed != 1)
                {
                    var current = await db.FundingInstructions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == instructionId, cancellationToken);
                    return Results.Conflict(new { currentRevision = current?.Revision, state = current?.State });
                }

                var review = new OrganizationFundingInstructionEventRecord
                {
                    Id = Guid.NewGuid(), FundingInstructionId = instructionId, Revision = input.Revision + 1,
                    EventType = decision!, SourceInstructionReference = funding.SourceInstructionReference,
                    Reason = reason, ActorAccountId = auth.AccountId!.Value, OccurredAtUtc = now, IdempotencyKey = key
                };
                db.FundingInstructionEvents.Add(review);
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Results.Created($"/api/v1/admin/organization-funding-instructions/{instructionId}/events/{review.Id}", EventProjection(review));
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("ReviewOrganizationFundingInstruction");

        app.MapGet("/api/v1/admin/organization-funding-instructions/{instructionId:guid}/events", async (
            Guid instructionId, HttpContext context, IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var auth = await Admin(context, services, hasDatabase, cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (instructionId == Guid.Empty) return Results.NotFound();
            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                if (!await db.FundingInstructions.AsNoTracking().AnyAsync(x => x.Id == instructionId, cancellationToken))
                    return Results.NotFound();
                var events = await db.FundingInstructionEvents.AsNoTracking()
                    .Where(x => x.FundingInstructionId == instructionId)
                    .OrderBy(x => x.Revision)
                    .Select(x => new
                    {
                        eventId = x.Id, instructionId = x.FundingInstructionId, revision = x.Revision,
                        decision = x.EventType, reference = x.SourceInstructionReference, reason = x.Reason,
                        actorAccountId = x.ActorAccountId, occurredAtUtc = x.OccurredAtUtc
                    }).ToListAsync(cancellationToken);
                return Results.Ok(new { events });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Admin").WithName("GetOrganizationFundingInstructionReviewEvents");

        app.MapPut("/api/v1/organization/programs/{programId:guid}/funding-instruction", async (
            Guid programId, FundingInstructionResubmissionInput input, HttpContext context,
            IServiceProvider services, CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!context.Request.IsHttps && !app.Environment.IsDevelopment()) return Results.StatusCode(503);
            var account = await OrganizationAccount(context, services, hasDatabase, cancellationToken);
            if (account.Error is not null) return account.Error;
            var reference = input.SourceInstructionReference?.Trim();
            if (programId == Guid.Empty || input.Revision < 1 || string.IsNullOrWhiteSpace(reference) ||
                reference.Length > 160 || reference.Any(char.IsControl))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["fundingInstruction"] = ["ارجاع یا نسخه معتبر نیست."] });
            if (!Guid.TryParse(context.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["idempotencyKey"] = ["کلید یکتای درخواست معتبر نیست."] });

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var access = await (from membership in db.Memberships.AsNoTracking()
                    join program in db.Programs.AsNoTracking() on membership.OrganizationId equals program.OrganizationId
                    join instruction in db.FundingInstructions.AsNoTracking() on program.Id equals instruction.ProgramId
                    where membership.AccountId == account.AccountId && membership.RevokedAtUtc == null &&
                        program.Id == programId
                    select new { Instruction = instruction, Program = program, membership.Role }).SingleOrDefaultAsync(cancellationToken);
                if (access is null) return Results.NotFound();
                if (access.Role == OrganizationRoles.TechnicalOperator) return Results.StatusCode(403);
                if (access.Program.State != "DRAFT" || access.Program.Revision != access.Instruction.ProgramRevision)
                    return Results.Conflict();

                var prior = await db.FundingInstructionEvents.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.IdempotencyKey == key, cancellationToken);
                if (prior is not null)
                {
                    if (prior.FundingInstructionId != access.Instruction.Id || prior.Revision != input.Revision + 1 ||
                        prior.EventType != OrganizationFundingInstructionEvents.Resubmitted ||
                        prior.SourceInstructionReference != reference || prior.ActorAccountId != account.AccountId)
                        return Results.Conflict();
                    var current = await db.FundingInstructions.AsNoTracking()
                        .SingleAsync(x => x.Id == access.Instruction.Id, cancellationToken);
                    return Results.Ok(InstructionProjection(current));
                }
                if (access.Instruction.State != "REJECTED" || access.Instruction.Revision != input.Revision)
                    return Results.Conflict(new { currentRevision = access.Instruction.Revision, state = access.Instruction.State });

                var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                var changed = await db.FundingInstructions
                    .Where(x => x.Id == access.Instruction.Id && x.State == "REJECTED" && x.Revision == input.Revision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.SourceInstructionReference, reference)
                        .SetProperty(x => x.State, "PENDING_VERIFICATION")
                        .SetProperty(x => x.Revision, x => x.Revision + 1)
                        .SetProperty(x => x.ReviewedByAccountId, (Guid?)null)
                        .SetProperty(x => x.ReviewedAtUtc, (DateTimeOffset?)null)
                        .SetProperty(x => x.ReviewReason, (string?)null), cancellationToken);
                if (changed != 1) return Results.Conflict();

                var resubmission = new OrganizationFundingInstructionEventRecord
                {
                    Id = Guid.NewGuid(), FundingInstructionId = access.Instruction.Id, Revision = input.Revision + 1,
                    EventType = OrganizationFundingInstructionEvents.Resubmitted,
                    SourceInstructionReference = reference, Reason = null, ActorAccountId = account.AccountId!.Value,
                    OccurredAtUtc = now, IdempotencyKey = key
                };
                db.FundingInstructionEvents.Add(resubmission);
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                var updated = await db.FundingInstructions.AsNoTracking()
                    .SingleAsync(x => x.Id == access.Instruction.Id, cancellationToken);
                return Results.Ok(InstructionProjection(updated));
            }
            catch (DbUpdateException) when (!cancellationToken.IsCancellationRequested) { return Results.Conflict(); }
            catch (Exception) when (!cancellationToken.IsCancellationRequested) { return Results.StatusCode(503); }
        }).WithTags("Organization").WithName("ResubmitOrganizationFundingInstruction");
    }

    private static object EventProjection(OrganizationFundingInstructionEventRecord item) => new
    {
        eventId = item.Id, instructionId = item.FundingInstructionId, revision = item.Revision,
        decision = item.EventType, reference = item.SourceInstructionReference, reason = item.Reason,
        actorAccountId = item.ActorAccountId, occurredAtUtc = item.OccurredAtUtc
    };

    private static object InstructionProjection(OrganizationFundingInstructionRecord item) => new
    {
        instructionId = item.Id, programId = item.ProgramId, programRevision = item.ProgramRevision,
        allocationMode = item.AllocationMode, sourceInstructionReference = item.SourceInstructionReference,
        state = item.State, revision = item.Revision, submittedAtUtc = item.SubmittedAtUtc,
        reviewReason = item.ReviewReason, reviewedAtUtc = item.ReviewedAtUtc
    };

    private static async Task<(Guid? AccountId, IResult? Error)> Admin(
        HttpContext context, IServiceProvider services, bool hasDatabase, CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase) return (null, Results.StatusCode(503));
        var accountId = await services.GetRequiredService<AuthSessionService>().ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        return await services.GetRequiredService<RoleAuthorizationService>()
            .HasRoleAsync(accountId.Value, HanaRoles.Admin, cancellationToken)
            ? (accountId, null) : (null, Results.StatusCode(403));
    }

    private static async Task<(Guid? AccountId, IResult? Error)> OrganizationAccount(
        HttpContext context, IServiceProvider services, bool hasDatabase, CancellationToken cancellationToken)
    {
        var token = BearerToken(context);
        if (token is null) return (null, Results.Unauthorized());
        if (!hasDatabase) return (null, Results.StatusCode(503));
        var accountId = await services.GetRequiredService<AuthSessionService>().ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());
        var db = services.GetRequiredService<HanaOrganizationDbContext>();
        return await db.Memberships.AsNoTracking().AnyAsync(x =>
            x.AccountId == accountId.Value && x.RevokedAtUtc == null, cancellationToken)
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

internal sealed record FundingInstructionReviewInput(int Revision, string? Decision, string? Reason);
internal sealed record FundingInstructionResubmissionInput(int Revision, string? SourceInstructionReference);
