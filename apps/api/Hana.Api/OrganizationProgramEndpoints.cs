using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationProgramEndpoints
{
    private const int MaxMutationBodyBytes = 16 * 1024;

    private sealed record RequestAccess(
        Guid AccountId,
        Guid OrganizationId,
        string MemberRole);

    private sealed record DraftInput(
        string Name,
        string Kind,
        string BeneficiarySource,
        string? Description,
        int? Revision);

    private static IResult Invalid(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["program"] = [message]
        });

    private static async Task<(RequestAccess? Access, IResult? Error)> AuthorizeAsync(
        HttpContext context,
        IServiceProvider services,
        bool hasDatabase,
        bool isDevelopment,
        CancellationToken cancellationToken)
    {
        if (!context.Request.IsHttps && !isDevelopment)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith(
                "Bearer ", StringComparison.OrdinalIgnoreCase) ||
            !SessionTokenCodec.TryComputeDigest(authorization[7..], out _))
            return (null, Results.Unauthorized());

        if (!hasDatabase)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        try
        {
            var accountId = await services.GetRequiredService<AuthSessionService>()
                .ResolveAccountAsync(authorization[7..], cancellationToken);
            if (accountId is null)
                return (null, Results.Unauthorized());

            var access = await services
                .GetRequiredService<OrganizationAccessService>()
                .ResolveAccessAsync(accountId.Value, cancellationToken);
            return access is null
                ? (null, Results.StatusCode(StatusCodes.Status403Forbidden))
                : (new RequestAccess(
                    accountId.Value,
                    access.OrganizationId,
                    access.MemberRole), null);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));
        }
    }

    private static bool HasForbiddenControlCharacters(string value) =>
        value.Any(char.IsControl);

    private static bool TryRequiredString(
        JsonElement root,
        string propertyName,
        int maxLength,
        out string value)
    {
        value = string.Empty;
        if (!root.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.String)
            return false;

        var raw = property.GetString() ?? string.Empty;
        var normalized = raw.Trim();
        if (normalized.Length is 0 || normalized.Length > maxLength ||
            HasForbiddenControlCharacters(raw))
            return false;

        value = normalized;
        return true;
    }

    private static bool TryDescription(
        JsonElement root,
        out string? description)
    {
        description = null;
        if (!root.TryGetProperty("description", out var property) ||
            property.ValueKind == JsonValueKind.Null)
            return true;
        if (property.ValueKind != JsonValueKind.String)
            return false;

        var raw = property.GetString() ?? string.Empty;
        if (raw.Length > 2000 || HasForbiddenControlCharacters(raw))
            return false;
        description = string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();
        return true;
    }

    private static async Task<(DraftInput? Input, IResult? Error)> ReadDraftAsync(
        HttpContext context,
        bool requireRevision,
        CancellationToken cancellationToken)
    {
        if (context.Request.ContentLength is > MaxMutationBodyBytes)
            return (null, Results.StatusCode(
                StatusCodes.Status413PayloadTooLarge));

        if (context.Request.ContentType is null ||
            !context.Request.ContentType.StartsWith(
                "application/json", StringComparison.OrdinalIgnoreCase))
            return (null, Results.StatusCode(
                StatusCodes.Status415UnsupportedMediaType));

        try
        {
            using var document = await JsonDocument.ParseAsync(
                context.Request.Body,
                new JsonDocumentOptions { MaxDepth = 8 },
                cancellationToken);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return (null, Invalid("بدنه درخواست باید یک شیء JSON باشد."));

            var allowed = requireRevision
                ? new HashSet<string>(
                    ["name", "kind", "beneficiarySource", "description", "revision"],
                    StringComparer.Ordinal)
                : new HashSet<string>(
                    ["name", "kind", "beneficiarySource", "description"],
                    StringComparer.Ordinal);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (!allowed.Contains(property.Name) ||
                    !seen.Add(property.Name))
                    return (null, Invalid(
                        "فیلد ناشناخته یا تکراری در درخواست وجود دارد."));
            }

            if (!TryRequiredString(root, "name", 200, out var name) ||
                !TryRequiredString(root, "kind", 120, out var kind) ||
                !TryRequiredString(
                    root, "beneficiarySource", 120, out var beneficiarySource) ||
                !OrganizationBeneficiarySources.IsKnown(beneficiarySource) ||
                !TryDescription(root, out var description))
                return (null, Invalid("اطلاعات طرح معتبر نیست."));

            int? revision = null;
            if (requireRevision)
            {
                if (!root.TryGetProperty("revision", out var revisionElement) ||
                    revisionElement.ValueKind != JsonValueKind.Number ||
                    !revisionElement.TryGetInt32(out var parsedRevision) ||
                    parsedRevision < 1)
                    return (null, Invalid("نسخه ویرایش طرح معتبر نیست."));
                revision = parsedRevision;
            }

            return (new DraftInput(
                name,
                kind,
                beneficiarySource,
                description,
                revision), null);
        }
        catch (JsonException)
        {
            return (null, Invalid("JSON درخواست معتبر نیست."));
        }
    }

    private static bool TryIdempotencyKey(
        HttpContext context,
        out Guid key)
    {
        key = Guid.Empty;
        var values = context.Request.Headers["Idempotency-Key"];
        return values.Count == 1 &&
            Guid.TryParse(values[0], out key) &&
            key != Guid.Empty;
    }

    private static bool SameCreatePayload(
        OrganizationProgramRecord existing,
        DraftInput input) =>
        existing.Name == input.Name &&
        existing.Kind == input.Kind &&
        existing.BeneficiarySource == input.BeneficiarySource &&
        existing.Description == input.Description;

    private static object ToMutationResponse(
        OrganizationProgramRecord program) => new
    {
        program.Id,
        program.Name,
        program.Kind,
        program.AllocationMethod,
        program.BeneficiarySource,
        program.Description,
        program.Status,
        program.Revision,
        program.CreatedAtUtc,
        program.UpdatedAtUtc
    };

    internal static void MapOrganizationPrograms(
        this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/organization/programs")
            .WithTags("Organization");

        routes.MapGet("", async (
            HttpContext context,
            IServiceProvider services,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] string? status,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";

            var allowedQuery = new HashSet<string>(
                ["page", "pageSize", "status"],
                StringComparer.OrdinalIgnoreCase);
            if (context.Request.Query.Keys.Any(k => !allowedQuery.Contains(k)))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] = ["پارامتر ناشناخته در درخواست وجود دارد."]
                    });

            var number = page ?? 1;
            var size = pageSize ?? 20;
            var normalizedStatus = string.IsNullOrWhiteSpace(status)
                ? null : status.Trim().ToUpperInvariant();

            if (number is < 1 or > 10000 ||
                size is < 1 or > 50 ||
                (normalizedStatus is not null &&
                    !OrganizationProgramStates.IsKnown(normalizedStatus)))
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] =
                            ["پارامترهای وضعیت یا صفحه‌بندی معتبر نیست."]
                    });

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var query = db.Programs.AsNoTracking()
                    .Where(p => p.OrganizationId == auth.Access!.OrganizationId);

                if (normalizedStatus is not null)
                    query = query.Where(p => p.Status == normalizedStatus);

                var total = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(p => p.CreatedAtUtc)
                    .ThenBy(p => p.Id)
                    .Skip((number - 1) * size)
                    .Take(size)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.Kind,
                        p.AllocationMethod,
                        p.BeneficiarySource,
                        p.Status,
                        p.CreatedAtUtc,
                        p.UpdatedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                return Results.Ok(new
                {
                    items,
                    page = number,
                    pageSize = size,
                    total
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetOrganizationPrograms")
        .ProducesValidationProblem();

        routes.MapGet("/{id:guid}", async (
            Guid id,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (id == Guid.Empty) return Results.NotFound();

            if (context.Request.Query.Count != 0)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["query"] = ["این مسیر پارامتر query نمی‌پذیرد."]
                    });

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var item = await db.Programs.AsNoTracking()
                    .Where(p => p.Id == id &&
                        p.OrganizationId == auth.Access!.OrganizationId)
                    .Select(p => new
                    {
                        p.Id,
                        p.Name,
                        p.Kind,
                        p.AllocationMethod,
                        p.BeneficiarySource,
                        p.Description,
                        p.Status,
                        p.Revision,
                        p.CreatedAtUtc,
                        p.UpdatedAtUtc
                    })
                    .SingleOrDefaultAsync(cancellationToken);

                // Cross-tenant IDs are intentionally indistinguishable from
                // nonexistent IDs to prevent organization enumeration.
                return item is null ? Results.NotFound() : Results.Ok(item);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("GetOrganizationProgram")
        .ProducesValidationProblem();

        routes.MapPost("", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (context.Request.Query.Count != 0)
                return Invalid("این مسیر پارامتر query نمی‌پذیرد.");

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (!OrganizationProgramPermissions.CanManageDrafts(
                    auth.Access!.MemberRole))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            if (!TryIdempotencyKey(context, out var creationKey))
                return Invalid("Idempotency-Key معتبر و غیرخالی الزامی است.");

            var parsed = await ReadDraftAsync(
                context, requireRevision: false, cancellationToken);
            if (parsed.Error is not null) return parsed.Error;
            var input = parsed.Input!;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var existing = await db.Programs.AsNoTracking()
                    .SingleOrDefaultAsync(
                        p => p.OrganizationId == auth.Access.OrganizationId &&
                            p.CreationKey == creationKey,
                        cancellationToken);
                if (existing is not null)
                    return SameCreatePayload(existing, input)
                        ? Results.Ok(ToMutationResponse(existing))
                        : Results.Conflict(new
                        {
                            message =
                                "این Idempotency-Key قبلاً برای درخواست دیگری استفاده شده است."
                        });

                var allocationMethod = await db.Organizations.AsNoTracking()
                    .Where(o => o.Id == auth.Access.OrganizationId && o.IsActive)
                    .Select(o => o.DefaultAllocationMethod)
                    .SingleOrDefaultAsync(cancellationToken);
                if (allocationMethod is null)
                    return Results.StatusCode(StatusCodes.Status403Forbidden);

                var now = DateTimeOffset.UtcNow;
                var program = new OrganizationProgramRecord
                {
                    Id = Guid.NewGuid(),
                    OrganizationId = auth.Access.OrganizationId,
                    Name = input.Name,
                    Kind = input.Kind,
                    AllocationMethod = allocationMethod,
                    BeneficiarySource = input.BeneficiarySource,
                    Description = input.Description,
                    Status = OrganizationProgramStates.Draft,
                    Revision = 1,
                    CreationKey = creationKey,
                    CreatedByAccountId = auth.Access.AccountId,
                    UpdatedByAccountId = auth.Access.AccountId,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                };
                db.Programs.Add(program);
                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                    return Results.Created(
                        $"/api/v1/organization/programs/{program.Id}",
                        ToMutationResponse(program));
                }
                catch (DbUpdateException)
                {
                    // A concurrent retry with the same key may win the unique
                    // index race. Re-read and return the same resource only if
                    // the client payload is identical; otherwise fail closed.
                    db.ChangeTracker.Clear();
                    var replay = await db.Programs.AsNoTracking()
                        .SingleOrDefaultAsync(
                            p => p.OrganizationId == auth.Access.OrganizationId &&
                                p.CreationKey == creationKey,
                            cancellationToken);
                    if (replay is null)
                        return Results.StatusCode(
                            StatusCodes.Status503ServiceUnavailable);
                    return SameCreatePayload(replay, input)
                        ? Results.Ok(ToMutationResponse(replay))
                        : Results.Conflict(new
                        {
                            message =
                                "این Idempotency-Key قبلاً برای درخواست دیگری استفاده شده است."
                        });
                }
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("CreateOrganizationProgramDraft")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status409Conflict);

        routes.MapPut("/{id:guid}", async (
            Guid id,
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (id == Guid.Empty) return Results.NotFound();
            if (context.Request.Query.Count != 0)
                return Invalid("این مسیر پارامتر query نمی‌پذیرد.");

            var auth = await AuthorizeAsync(
                context, services, hasDatabase, app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (!OrganizationProgramPermissions.CanManageDrafts(
                    auth.Access!.MemberRole))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            var parsed = await ReadDraftAsync(
                context, requireRevision: true, cancellationToken);
            if (parsed.Error is not null) return parsed.Error;
            var input = parsed.Input!;
            var expectedRevision = input.Revision!.Value;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var now = DateTimeOffset.UtcNow;
                var affected = await db.Programs
                    .Where(p => p.Id == id &&
                        p.OrganizationId == auth.Access.OrganizationId &&
                        p.Status == OrganizationProgramStates.Draft &&
                        p.Revision == expectedRevision)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(p => p.Name, input.Name)
                        .SetProperty(p => p.Kind, input.Kind)
                        .SetProperty(
                            p => p.BeneficiarySource,
                            input.BeneficiarySource)
                        .SetProperty(p => p.Description, input.Description)
                        .SetProperty(
                            p => p.UpdatedByAccountId,
                            auth.Access.AccountId)
                        .SetProperty(p => p.UpdatedAtUtc, now)
                        .SetProperty(p => p.Revision, p => p.Revision + 1),
                        cancellationToken);

                if (affected == 1)
                {
                    var updated = await db.Programs.AsNoTracking()
                        .SingleAsync(
                            p => p.Id == id &&
                                p.OrganizationId == auth.Access.OrganizationId,
                            cancellationToken);
                    return Results.Ok(ToMutationResponse(updated));
                }

                var current = await db.Programs.AsNoTracking()
                    .Where(p => p.Id == id &&
                        p.OrganizationId == auth.Access.OrganizationId)
                    .Select(p => new { p.Status, p.Revision })
                    .SingleOrDefaultAsync(cancellationToken);
                if (current is null)
                    return Results.NotFound();

                if (current.Status != OrganizationProgramStates.Draft)
                    return Results.Conflict(new
                    {
                        message = "فقط طرح پیش‌نویس قابل ویرایش است."
                    });

                return Results.Conflict(new
                {
                    message =
                        "نسخه طرح تغییر کرده است؛ ابتدا نسخه جدید را دریافت کنید.",
                    currentRevision = current.Revision
                });
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("UpdateOrganizationProgramDraft")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status409Conflict);
    }
}
