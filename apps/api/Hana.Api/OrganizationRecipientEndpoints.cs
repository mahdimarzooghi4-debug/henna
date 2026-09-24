using System.Text;
using System.Text.Json;
using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationRecipientEndpoints
{
    private const int MaxMutationBodyBytes = 8 * 1024;

    private sealed record RecipientAccess(
        Guid AccountId,
        Guid OrganizationId,
        string MemberRole);

    private sealed record ManualRecipientInput(
        string DisplayName,
        string ExternalReference,
        string? Phone,
        Guid ProgramId);

    private static async Task<(RecipientAccess? Access, IResult? Error)>
        AuthorizeAsync(
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
                : (new RecipientAccess(
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

    private static IResult InvalidQuery(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["query"] = [message]
        });

    private static IResult InvalidRecipient(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["recipient"] = [message]
        });

    private static bool HasControlCharacters(string value) =>
        value.Any(char.IsControl);

    private static string EscapeLike(string value) =>
        value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

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

    private static bool TryExternalReference(
        string? input,
        out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input) ||
            HasControlCharacters(input))
            return false;

        var text = input.Trim().Normalize(NormalizationForm.FormKC);
        if (text.Length is 0 or > 80)
            return false;

        var builder = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            builder.Append(ch switch
            {
                >= '\u06F0' and <= '\u06F9' =>
                    (char)('0' + ch - '\u06F0'),
                >= '\u0660' and <= '\u0669' =>
                    (char)('0' + ch - '\u0660'),
                _ => ch
            });
        }

        normalized = builder.ToString();
        return normalized.Length > 0;
    }

    private static string MaskReference(string value)
    {
        if (value.Length <= 4)
            return new string('*', value.Length);
        if (value.Length <= 8)
            return value[..1] +
                new string('*', Math.Max(3, value.Length - 2)) +
                value[^1..];
        return value[..3] + "****" + value[^3..];
    }

    private static bool SameCreateRequest(
        OrganizationRecipientRecord existing,
        string fingerprint) =>
        string.Equals(
            existing.CreationFingerprint,
            fingerprint,
            StringComparison.Ordinal);

    private static bool ProgramAcceptsRecipients(string status) =>
        status is OrganizationProgramStates.Registered
            or OrganizationProgramStates.Active;

    private static object ToResponse(
        OrganizationRecipientRecord recipient,
        OrganizationProgramRecord program) => new
    {
        recipient.Id,
        recipient.DisplayName,
        recipient.ReferenceMasked,
        recipient.Source,
        recipient.MatchStatus,
        hanaAccountMatched = recipient.MatchedAccountId != null,
        program = new
        {
            program.Id,
            program.Name,
            program.Status
        },
        recipient.CreatedAtUtc,
        recipient.UpdatedAtUtc
    };

    private static async Task<(ManualRecipientInput? Input, IResult? Error)>
        ReadManualRecipientAsync(
            HttpContext context,
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
                new JsonDocumentOptions { MaxDepth = 4 },
                cancellationToken);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return (null, InvalidRecipient(
                    "بدنه ثبت مشمول باید یک شیء JSON باشد."));

            var allowed = new HashSet<string>(
                ["displayName", "externalReference", "phone", "programId"],
                StringComparer.Ordinal);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (!allowed.Contains(property.Name) ||
                    !seen.Add(property.Name))
                    return (null, InvalidRecipient(
                        "فیلد ناشناخته یا تکراری در درخواست وجود دارد."));
            }
            if (seen.Count != allowed.Count)
                return (null, InvalidRecipient(
                    "همه فیلدهای ثبت مشمول باید ارسال شوند."));

            if (!root.TryGetProperty("displayName", out var nameElement) ||
                nameElement.ValueKind != JsonValueKind.String)
                return (null, InvalidRecipient("نام نمایشی معتبر نیست."));
            var rawName = nameElement.GetString() ?? string.Empty;
            var displayName = rawName.Trim();
            if (displayName.Length is 0 or > 200 ||
                HasControlCharacters(rawName))
                return (null, InvalidRecipient("نام نمایشی معتبر نیست."));

            if (!root.TryGetProperty(
                    "externalReference", out var referenceElement) ||
                referenceElement.ValueKind != JsonValueKind.String ||
                !TryExternalReference(
                    referenceElement.GetString(), out var externalReference))
                return (null, InvalidRecipient(
                    "شناسه موردنیاز سازمان معتبر نیست."));

            string? phone = null;
            if (!root.TryGetProperty("phone", out var phoneElement))
                return (null, InvalidRecipient("شماره همراه معتبر نیست."));
            if (phoneElement.ValueKind == JsonValueKind.String)
            {
                var rawPhone = phoneElement.GetString();
                if (!string.IsNullOrWhiteSpace(rawPhone))
                {
                    if (!IranianMobileNumber.TryParse(
                            rawPhone, out var normalizedPhone))
                        return (null, InvalidRecipient(
                            "شماره همراه معتبر نیست."));
                    phone = normalizedPhone!.Value;
                }
            }
            else if (phoneElement.ValueKind != JsonValueKind.Null)
            {
                return (null, InvalidRecipient("شماره همراه معتبر نیست."));
            }

            if (!root.TryGetProperty("programId", out var programElement) ||
                programElement.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(programElement.GetString(), out var programId) ||
                programId == Guid.Empty)
                return (null, InvalidRecipient("شناسه طرح معتبر نیست."));

            return (new ManualRecipientInput(
                displayName,
                externalReference,
                phone,
                programId), null);
        }
        catch (JsonException)
        {
            return (null, InvalidRecipient("JSON درخواست معتبر نیست."));
        }
    }

    internal static void MapOrganizationRecipients(
        this WebApplication app, bool hasDatabase)
    {
        var routes = app.MapGroup("/api/v1/organization/recipients")
            .WithTags("Organization");

        routes.MapGet("", async (
            HttpContext context,
            IServiceProvider services,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] string? programId,
            [FromQuery] string? source,
            [FromQuery] string? matchStatus,
            [FromQuery] string? search,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";

            var allowedQuery = new HashSet<string>(
                ["page", "pageSize", "programId", "source", "matchStatus", "search"],
                StringComparer.OrdinalIgnoreCase);
            if (context.Request.Query.Keys.Any(k => !allowedQuery.Contains(k)))
                return InvalidQuery(
                    "پارامتر ناشناخته در درخواست وجود دارد.");
            if (context.Request.Query.Any(pair => pair.Value.Count != 1))
                return InvalidQuery(
                    "هر پارامتر query فقط یک مقدار می‌پذیرد.");

            var number = page ?? 1;
            var size = pageSize ?? 20;
            if (number is < 1 or > 10000 || size is < 1 or > 50)
                return InvalidQuery("صفحه‌بندی معتبر نیست.");

            Guid? normalizedProgramId = null;
            if (!string.IsNullOrWhiteSpace(programId))
            {
                if (!Guid.TryParse(programId.Trim(), out var parsedProgramId) ||
                    parsedProgramId == Guid.Empty)
                    return InvalidQuery("شناسه طرح معتبر نیست.");
                normalizedProgramId = parsedProgramId;
            }

            var normalizedSource = string.IsNullOrWhiteSpace(source)
                ? null : source.Trim().ToUpperInvariant();
            if (normalizedSource is not null &&
                !OrganizationRecipientSources.IsKnown(normalizedSource))
                return InvalidQuery("منبع ثبت معتبر نیست.");

            var normalizedMatchStatus = string.IsNullOrWhiteSpace(matchStatus)
                ? null : matchStatus.Trim().ToUpperInvariant();
            if (normalizedMatchStatus is not null &&
                !OrganizationRecipientMatchStates.IsKnown(
                    normalizedMatchStatus))
                return InvalidQuery("وضعیت تطبیق معتبر نیست.");

            var normalizedSearch = string.IsNullOrWhiteSpace(search)
                ? null : search.Trim();
            if (normalizedSearch is not null &&
                (normalizedSearch.Length > 120 ||
                    HasControlCharacters(normalizedSearch)))
                return InvalidQuery("عبارت جستجو معتبر نیست.");

            var auth = await AuthorizeAsync(
                context,
                services,
                hasDatabase,
                app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();
                var recipients = db.Recipients.AsNoTracking()
                    .Where(r =>
                        r.OrganizationId == auth.Access!.OrganizationId);

                if (normalizedProgramId is { } targetProgramId)
                    recipients = recipients.Where(
                        r => r.ProgramId == targetProgramId);
                if (normalizedSource is not null)
                    recipients = recipients.Where(
                        r => r.Source == normalizedSource);
                if (normalizedMatchStatus is not null)
                    recipients = recipients.Where(
                        r => r.MatchStatus == normalizedMatchStatus);
                if (normalizedSearch is not null)
                {
                    var pattern =
                        $"%{EscapeLike(normalizedSearch)}%";
                    recipients = recipients.Where(r =>
                        EF.Functions.ILike(
                            r.DisplayName, pattern, "\\") ||
                        EF.Functions.ILike(
                            r.ReferenceMasked, pattern, "\\"));
                }

                var total = await recipients.CountAsync(cancellationToken);
                var pageRows = recipients
                    .OrderByDescending(r => r.CreatedAtUtc)
                    .ThenBy(r => r.Id)
                    .Skip((number - 1) * size)
                    .Take(size);

                var items = await (
                    from recipient in pageRows
                    join program in db.Programs.AsNoTracking()
                        on new
                        {
                            Id = recipient.ProgramId,
                            recipient.OrganizationId
                        }
                        equals new
                        {
                            program.Id,
                            program.OrganizationId
                        }
                    select new
                    {
                        recipient.Id,
                        recipient.DisplayName,
                        recipient.ReferenceMasked,
                        recipient.Source,
                        recipient.MatchStatus,
                        hanaAccountMatched =
                            recipient.MatchedAccountId != null,
                        program = new
                        {
                            program.Id,
                            program.Name,
                            program.Status
                        },
                        recipient.CreatedAtUtc,
                        recipient.UpdatedAtUtc
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
        .WithName("GetOrganizationRecipients")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        routes.MapPost("", async (
            HttpContext context,
            IServiceProvider services,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (context.Request.Query.Count != 0)
                return InvalidRecipient(
                    "این مسیر پارامتر query نمی‌پذیرد.");

            var auth = await AuthorizeAsync(
                context,
                services,
                hasDatabase,
                app.Environment.IsDevelopment(),
                cancellationToken);
            if (auth.Error is not null) return auth.Error;
            if (!OrganizationRecipientPermissions.CanCreateManual(
                    auth.Access!.MemberRole))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            if (!TryIdempotencyKey(context, out var creationKey))
                return InvalidRecipient(
                    "Idempotency-Key معتبر و غیرخالی برای ثبت مشمول الزامی است.");

            var parsed = await ReadManualRecipientAsync(
                context, cancellationToken);
            if (parsed.Error is not null) return parsed.Error;
            var input = parsed.Input!;

            var cryptography =
                services.GetService<OrganizationRecipientCryptography>();
            if (cryptography is null)
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);

            var creationFingerprint = cryptography.CreationFingerprint(
                auth.Access.OrganizationId,
                input.ProgramId,
                input.DisplayName,
                input.ExternalReference,
                input.Phone);
            var referenceFingerprint = cryptography.ReferenceFingerprint(
                auth.Access.OrganizationId,
                input.ProgramId,
                input.ExternalReference);

            try
            {
                var db = services.GetRequiredService<HanaOrganizationDbContext>();

                var replay = await db.Recipients.AsNoTracking()
                    .SingleOrDefaultAsync(
                        r => r.OrganizationId == auth.Access.OrganizationId &&
                            r.CreationKey == creationKey,
                        cancellationToken);
                if (replay is not null)
                {
                    if (!SameCreateRequest(replay, creationFingerprint))
                        return Results.Conflict(new
                        {
                            message =
                                "این Idempotency-Key برای درخواست دیگری استفاده شده است."
                        });

                    var replayProgram = await db.Programs.AsNoTracking()
                        .SingleOrDefaultAsync(
                            p => p.Id == replay.ProgramId &&
                                p.OrganizationId == auth.Access.OrganizationId,
                            cancellationToken);
                    return replayProgram is null
                        ? Results.StatusCode(
                            StatusCodes.Status503ServiceUnavailable)
                        : Results.Ok(ToResponse(replay, replayProgram));
                }

                var program = await db.Programs.AsNoTracking()
                    .SingleOrDefaultAsync(
                        p => p.Id == input.ProgramId &&
                            p.OrganizationId == auth.Access.OrganizationId,
                        cancellationToken);
                if (program is null)
                    return Results.NotFound();
                if (!ProgramAcceptsRecipients(program.Status))
                    return Results.Conflict(new
                    {
                        message =
                            "در وضعیت فعلی این طرح امکان افزودن مشمول جدید وجود ندارد.",
                        currentStatus = program.Status
                    });

                var duplicate = await db.Recipients.AsNoTracking()
                    .SingleOrDefaultAsync(
                        r => r.OrganizationId == auth.Access.OrganizationId &&
                            r.ProgramId == input.ProgramId &&
                            r.ReferenceFingerprint == referenceFingerprint,
                        cancellationToken);
                if (duplicate is not null)
                    return Results.Conflict(new
                    {
                        message =
                            "این شناسه قبلاً برای همین طرح ثبت شده است.",
                        existingRecipientId = duplicate.Id
                    });

                Guid? matchedAccountId = null;
                if (input.Phone is not null)
                {
                    var identity =
                        services.GetRequiredService<HanaIdentityDbContext>();
                    matchedAccountId = await identity.Accounts.AsNoTracking()
                        .Where(a =>
                            a.NormalizedPhone == input.Phone &&
                            a.PhoneVerifiedAtUtc != null)
                        .Select(a => (Guid?)a.Id)
                        .SingleOrDefaultAsync(cancellationToken);
                }

                var now = DateTimeOffset.UtcNow;
                var recipient = new OrganizationRecipientRecord
                {
                    Id = Guid.NewGuid(),
                    OrganizationId = auth.Access.OrganizationId,
                    ProgramId = input.ProgramId,
                    DisplayName = input.DisplayName,
                    ReferenceMasked = MaskReference(input.ExternalReference),
                    ReferenceFingerprint = referenceFingerprint,
                    CreationKey = creationKey,
                    CreationFingerprint = creationFingerprint,
                    CreatedByAccountId = auth.Access.AccountId,
                    Source = OrganizationRecipientSources.Manual,
                    MatchStatus = matchedAccountId is null
                        ? OrganizationRecipientMatchStates.NeedsMatch
                        : OrganizationRecipientMatchStates.Matched,
                    MatchedAccountId = matchedAccountId,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                };
                db.Recipients.Add(recipient);

                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                    return Results.Json(
                        ToResponse(recipient, program),
                        statusCode: StatusCodes.Status201Created);
                }
                catch (DbUpdateException)
                {
                    db.ChangeTracker.Clear();

                    var afterKey = await db.Recipients.AsNoTracking()
                        .SingleOrDefaultAsync(
                            r => r.OrganizationId ==
                                    auth.Access.OrganizationId &&
                                r.CreationKey == creationKey,
                            cancellationToken);
                    if (afterKey is not null)
                    {
                        if (!SameCreateRequest(
                                afterKey, creationFingerprint))
                            return Results.Conflict(new
                            {
                                message =
                                    "این Idempotency-Key برای درخواست دیگری استفاده شده است."
                            });

                        var replayProgram = await db.Programs.AsNoTracking()
                            .SingleOrDefaultAsync(
                                p => p.Id == afterKey.ProgramId &&
                                    p.OrganizationId ==
                                        auth.Access.OrganizationId,
                                cancellationToken);
                        return replayProgram is null
                            ? Results.StatusCode(
                                StatusCodes.Status503ServiceUnavailable)
                            : Results.Ok(ToResponse(
                                afterKey, replayProgram));
                    }

                    var afterDuplicate = await db.Recipients.AsNoTracking()
                        .SingleOrDefaultAsync(
                            r => r.OrganizationId ==
                                    auth.Access.OrganizationId &&
                                r.ProgramId == input.ProgramId &&
                                r.ReferenceFingerprint ==
                                    referenceFingerprint,
                            cancellationToken);
                    if (afterDuplicate is not null)
                        return Results.Conflict(new
                        {
                            message =
                                "این شناسه قبلاً برای همین طرح ثبت شده است.",
                            existingRecipientId = afterDuplicate.Id
                        });

                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status503ServiceUnavailable);
            }
        })
        .WithName("CreateOrganizationRecipientManual")
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
