using System.Text;
using Hana.Domain.Identity;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Organization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class OrganizationRecipientBulkImportEndpoints
{
    private const long MaxRequestBytes = 3 * 1024 * 1024;

    private sealed record Access(
        Guid AccountId,
        Guid OrganizationId,
        string MemberRole);

    private sealed record ValidRow(
        int RowNumber,
        string DisplayName,
        string ExternalReference,
        string? Phone,
        string ReferenceFingerprint,
        string CreationFingerprint);

    private static async Task<(Access? Access, IResult? Error)> AuthorizeAsync(
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
                : (new Access(
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

    private static bool HasControlCharacters(string value) =>
        value.Any(char.IsControl);

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

    private static bool ProgramAcceptsRecipients(string status) =>
        status is OrganizationProgramStates.Registered
            or OrganizationProgramStates.Active;

    private static object RecipientResponse(
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

    private static object ImportResponse(
        OrganizationRecipientImportRecord import,
        IReadOnlyList<OrganizationRecipientRecord> recipients,
        OrganizationProgramRecord program) => new
    {
        importedCount = recipients.Count,
        matchedCount = recipients.Count(x =>
            x.MatchStatus == OrganizationRecipientMatchStates.Matched),
        needsMatchCount = recipients.Count(x =>
            x.MatchStatus == OrganizationRecipientMatchStates.NeedsMatch),
        atomic = true,
        items = recipients
            .OrderBy(x => x.ImportRowNumber)
            .Select(x => new
            {
                row = x.ImportRowNumber,
                recipient = RecipientResponse(x, program)
            })
            .ToArray(),
        importedAtUtc = import.CreatedAtUtc
    };

    private static IResult ImportErrors(
        int status,
        IEnumerable<OrganizationRecipientImportError> errors) =>
        Results.Json(
            new
            {
                importedCount = 0,
                atomic = true,
                errors = errors
                    .OrderBy(x => x.Row)
                    .ThenBy(x => x.Field, StringComparer.Ordinal)
                    .ToArray()
            },
            statusCode: status);

    private static async Task<(Guid? ProgramId, IFormFile? File, IResult? Error)>
        ReadMultipartAsync(
            HttpContext context,
            CancellationToken cancellationToken)
    {
        if (context.Request.ContentLength is > MaxRequestBytes)
            return (null, null, Results.StatusCode(
                StatusCodes.Status413PayloadTooLarge));

        if (!context.Request.HasFormContentType ||
            context.Request.ContentType is null ||
            !context.Request.ContentType.StartsWith(
                "multipart/form-data",
                StringComparison.OrdinalIgnoreCase))
            return (null, null, Results.StatusCode(
                StatusCodes.Status415UnsupportedMediaType));

        var bodySize =
            context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (bodySize is { IsReadOnly: false })
            bodySize.MaxRequestBodySize = MaxRequestBytes;

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return (null, null, Results.StatusCode(
                StatusCodes.Status413PayloadTooLarge));
        }

        if (form.Keys.Count != 1 ||
            !form.ContainsKey("programId") ||
            form["programId"].Count != 1 ||
            form.Files.Count != 1)
            return (null, null, Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["import"] =
                    [
                        "درخواست import باید دقیقاً شامل programId و یک فایل باشد."
                    ]
                }));

        var file = form.Files[0];
        if (!string.Equals(
                file.Name,
                "file",
                StringComparison.Ordinal) ||
            file.Length is <= 0 or >
                OrganizationRecipientImportParser.MaxFileBytes)
            return (null, null, Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["file"] =
                    [
                        "فایل معتبر CSV/XLSX با حداکثر حجم ۲ مگابایت الزامی است."
                    ]
                }));

        if (!Guid.TryParse(
                form["programId"][0],
                out var programId) ||
            programId == Guid.Empty)
            return (null, null, Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["programId"] = ["شناسه طرح معتبر نیست."]
                }));

        return (programId, file, null);
    }

    private static IReadOnlyList<OrganizationRecipientImportError>
        ValidateRows(
            IReadOnlyList<OrganizationRecipientImportRow> parsed,
            Guid organizationId,
            Guid programId,
            OrganizationRecipientCryptography cryptography,
            out IReadOnlyList<ValidRow> validRows)
    {
        var errors = new List<OrganizationRecipientImportError>();
        var rows = new List<ValidRow>();

        foreach (var row in parsed)
        {
            var rawName = row.DisplayName.Value;
            var name = rawName.Trim();
            if (name.Length is 0 or > 200 ||
                HasControlCharacters(rawName))
                errors.Add(new(
                    row.RowNumber,
                    "displayName",
                    "INVALID_NAME",
                    "نام نمایشی معتبر نیست."));

            if (!TryExternalReference(
                    row.ExternalReference.Value,
                    out var reference))
                errors.Add(new(
                    row.RowNumber,
                    "externalReference",
                    "INVALID_REFERENCE",
                    "شناسه موردنیاز معتبر نیست."));

            string? phone = null;
            var rawPhone = row.Phone.Value.Trim();
            if (rawPhone.Length > 0)
            {
                if (!IranianMobileNumber.TryParse(
                        rawPhone,
                        out var normalizedPhone))
                    errors.Add(new(
                        row.RowNumber,
                        "phone",
                        "INVALID_PHONE",
                        "شماره همراه معتبر نیست."));
                else
                    phone = normalizedPhone!.Value;
            }

            if (errors.Any(x => x.Row == row.RowNumber))
                continue;

            var referenceFingerprint =
                cryptography.ReferenceFingerprint(
                    organizationId,
                    programId,
                    reference);
            var creationFingerprint =
                cryptography.CreationFingerprint(
                    organizationId,
                    programId,
                    name,
                    reference,
                    phone);

            rows.Add(new(
                row.RowNumber,
                name,
                reference,
                phone,
                referenceFingerprint,
                creationFingerprint));
        }

        var firstByReference =
            new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (firstByReference.TryGetValue(
                    row.ReferenceFingerprint,
                    out var firstRow))
                errors.Add(new(
                    row.RowNumber,
                    "externalReference",
                    "DUPLICATE_IN_FILE",
                    $"شناسه این ردیف با ردیف {firstRow} تکراری است."));
            else
                firstByReference[row.ReferenceFingerprint] =
                    row.RowNumber;
        }

        validRows = rows;
        return errors;
    }

    private static bool ReplayMatches(
        OrganizationRecipientImportRecord import,
        Guid programId,
        string batchFingerprint,
        int rowCount) =>
        import.ProgramId == programId &&
        import.RowCount == rowCount &&
        string.Equals(
            import.BatchFingerprint,
            batchFingerprint,
            StringComparison.Ordinal);

    internal static void MapOrganizationRecipientBulkImport(
        this WebApplication app,
        bool hasDatabase)
    {
        app.MapPost(
            "/api/v1/organization/recipients/import",
            async (
                HttpContext context,
                IServiceProvider services,
                CancellationToken cancellationToken) =>
            {
                context.Response.Headers.CacheControl = "no-store";
                if (context.Request.Query.Count != 0)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["query"] =
                            [
                                "این مسیر پارامتر query نمی‌پذیرد."
                            ]
                        });

                var auth = await AuthorizeAsync(
                    context,
                    services,
                    hasDatabase,
                    app.Environment.IsDevelopment(),
                    cancellationToken);
                if (auth.Error is not null)
                    return auth.Error;
                if (!OrganizationRecipientPermissions.CanImportBulk(
                        auth.Access!.MemberRole))
                    return Results.StatusCode(
                        StatusCodes.Status403Forbidden);

                if (!TryIdempotencyKey(context, out var importKey))
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["import"] =
                            [
                                "Idempotency-Key معتبر برای import الزامی است."
                            ]
                        });

                var multipart = await ReadMultipartAsync(
                    context,
                    cancellationToken);
                if (multipart.Error is not null)
                    return multipart.Error;

                var cryptography = services
                    .GetService<OrganizationRecipientCryptography>();
                if (cryptography is null)
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);

                var parsed =
                    await OrganizationRecipientImportParser.ParseAsync(
                        multipart.File!,
                        cancellationToken);
                if (parsed.Errors.Count > 0)
                    return ImportErrors(
                        StatusCodes.Status422UnprocessableEntity,
                        parsed.Errors);

                var validationErrors = ValidateRows(
                    parsed.Rows,
                    auth.Access.OrganizationId,
                    multipart.ProgramId!.Value,
                    cryptography,
                    out var rows);
                if (validationErrors.Count > 0)
                    return ImportErrors(
                        StatusCodes.Status422UnprocessableEntity,
                        validationErrors);

                var batchFingerprint =
                    cryptography.ImportFingerprint(
                        auth.Access.OrganizationId,
                        multipart.ProgramId.Value,
                        rows.Select(x =>
                            (x.RowNumber, x.CreationFingerprint)));

                try
                {
                    var db =
                        services.GetRequiredService<HanaOrganizationDbContext>();

                    var replay = await db.RecipientImports
                        .AsNoTracking()
                        .SingleOrDefaultAsync(
                            x => x.OrganizationId ==
                                    auth.Access.OrganizationId &&
                                x.ImportKey == importKey,
                            cancellationToken);
                    if (replay is not null)
                    {
                        if (!ReplayMatches(
                                replay,
                                multipart.ProgramId.Value,
                                batchFingerprint,
                                rows.Count))
                            return Results.Conflict(new
                            {
                                importedCount = 0,
                                atomic = true,
                                message =
                                    "این Idempotency-Key برای import دیگری استفاده شده است."
                            });

                        var replayProgram = await db.Programs
                            .AsNoTracking()
                            .SingleOrDefaultAsync(
                                p => p.Id == replay.ProgramId &&
                                    p.OrganizationId ==
                                        auth.Access.OrganizationId,
                                cancellationToken);
                        if (replayProgram is null)
                            return Results.StatusCode(
                                StatusCodes.Status503ServiceUnavailable);

                        var replayRows = await db.Recipients
                            .AsNoTracking()
                            .Where(r =>
                                r.OrganizationId ==
                                    auth.Access.OrganizationId &&
                                r.ImportKey == importKey)
                            .OrderBy(r => r.ImportRowNumber)
                            .ToListAsync(cancellationToken);
                        if (replayRows.Count != replay.RowCount)
                            return Results.StatusCode(
                                StatusCodes.Status503ServiceUnavailable);

                        return Results.Ok(
                            ImportResponse(
                                replay,
                                replayRows,
                                replayProgram));
                    }

                    var program = await db.Programs
                        .AsNoTracking()
                        .SingleOrDefaultAsync(
                            p => p.Id == multipart.ProgramId.Value &&
                                p.OrganizationId ==
                                    auth.Access.OrganizationId,
                            cancellationToken);
                    if (program is null)
                        return Results.NotFound();
                    if (!ProgramAcceptsRecipients(program.Status))
                        return Results.Conflict(new
                        {
                            importedCount = 0,
                            atomic = true,
                            message =
                                "در وضعیت فعلی این طرح امکان import مشمول وجود ندارد.",
                            currentStatus = program.Status
                        });

                    var referenceFingerprints = rows
                        .Select(x => x.ReferenceFingerprint)
                        .Distinct(StringComparer.Ordinal)
                        .ToArray();
                    var existing = await db.Recipients
                        .AsNoTracking()
                        .Where(r =>
                            r.OrganizationId ==
                                auth.Access.OrganizationId &&
                            r.ProgramId == multipart.ProgramId.Value &&
                            r.ReferenceFingerprint != null &&
                            referenceFingerprints.Contains(
                                r.ReferenceFingerprint))
                        .Select(r => new
                        {
                            r.Id,
                            r.ReferenceFingerprint
                        })
                        .ToListAsync(cancellationToken);

                    if (existing.Count > 0)
                    {
                        var existingSet = existing
                            .Select(x => x.ReferenceFingerprint!)
                            .ToHashSet(StringComparer.Ordinal);
                        return ImportErrors(
                            StatusCodes.Status409Conflict,
                            rows
                                .Where(r =>
                                    existingSet.Contains(
                                        r.ReferenceFingerprint))
                                .Select(r =>
                                    new OrganizationRecipientImportError(
                                        r.RowNumber,
                                        "externalReference",
                                        "DUPLICATE_EXISTING",
                                        "این شناسه قبلاً برای همین طرح ثبت شده است.")));
                    }

                    var phones = rows
                        .Where(x => x.Phone is not null)
                        .Select(x => x.Phone!)
                        .Distinct(StringComparer.Ordinal)
                        .ToArray();
                    Dictionary<string, Guid> matchedAccounts;
                    if (phones.Length == 0)
                    {
                        matchedAccounts = new Dictionary<string, Guid>(
                            StringComparer.Ordinal);
                    }
                    else
                    {
                        var matches = await services
                            .GetRequiredService<HanaIdentityDbContext>()
                            .Accounts
                            .AsNoTracking()
                            .Where(a =>
                                a.PhoneVerifiedAtUtc != null &&
                                phones.Contains(a.NormalizedPhone))
                            .Select(a => new
                            {
                                a.NormalizedPhone,
                                a.Id
                            })
                            .ToListAsync(cancellationToken);
                        matchedAccounts = matches.ToDictionary(
                            x => x.NormalizedPhone,
                            x => x.Id,
                            StringComparer.Ordinal);
                    }

                    await using var transaction =
                        await db.Database.BeginTransactionAsync(
                            cancellationToken);
                    try
                    {
                        var lockedProgram = await db.Programs
                            .FromSqlInterpolated(
                                $"""
                                SELECT *
                                FROM organization.programs
                                WHERE id = {multipart.ProgramId.Value}
                                  AND organization_id = {auth.Access.OrganizationId}
                                FOR UPDATE
                                """)
                            .AsNoTracking()
                            .SingleOrDefaultAsync(cancellationToken);
                        if (lockedProgram is null)
                        {
                            await transaction.RollbackAsync(
                                cancellationToken);
                            return Results.NotFound();
                        }
                        if (!ProgramAcceptsRecipients(
                                lockedProgram.Status))
                        {
                            await transaction.RollbackAsync(
                                cancellationToken);
                            return Results.Conflict(new
                            {
                                importedCount = 0,
                                atomic = true,
                                message =
                                    "وضعیت طرح هنگام import تغییر کرده است.",
                                currentStatus = lockedProgram.Status
                            });
                        }

                        var now = DateTimeOffset.UtcNow;
                        var import = new OrganizationRecipientImportRecord
                        {
                            OrganizationId =
                                auth.Access.OrganizationId,
                            ImportKey = importKey,
                            ProgramId = multipart.ProgramId.Value,
                            BatchFingerprint = batchFingerprint,
                            RowCount = rows.Count,
                            CreatedByAccountId =
                                auth.Access.AccountId,
                            CreatedAtUtc = now
                        };
                        db.RecipientImports.Add(import);

                        var recipients =
                            new List<OrganizationRecipientRecord>(
                                rows.Count);
                        foreach (var row in rows)
                        {
                            Guid? matchedAccountId = null;
                            if (row.Phone is not null &&
                                matchedAccounts.TryGetValue(
                                    row.Phone,
                                    out var accountId))
                                matchedAccountId = accountId;

                            var recipient =
                                new OrganizationRecipientRecord
                                {
                                    Id = Guid.NewGuid(),
                                    OrganizationId =
                                        auth.Access.OrganizationId,
                                    ProgramId =
                                        multipart.ProgramId.Value,
                                    DisplayName = row.DisplayName,
                                    ReferenceMasked =
                                        MaskReference(
                                            row.ExternalReference),
                                    ReferenceFingerprint =
                                        row.ReferenceFingerprint,
                                    CreationKey = Guid.NewGuid(),
                                    CreationFingerprint =
                                        row.CreationFingerprint,
                                    CreatedByAccountId =
                                        auth.Access.AccountId,
                                    ImportKey = importKey,
                                    ImportRowNumber =
                                        row.RowNumber,
                                    Source =
                                        OrganizationRecipientSources.Manual,
                                    MatchStatus =
                                        matchedAccountId is null
                                            ? OrganizationRecipientMatchStates
                                                .NeedsMatch
                                            : OrganizationRecipientMatchStates
                                                .Matched,
                                    MatchedAccountId =
                                        matchedAccountId,
                                    CreatedAtUtc = now,
                                    UpdatedAtUtc = now
                                };
                            recipients.Add(recipient);
                        }

                        db.Recipients.AddRange(recipients);
                        await db.SaveChangesAsync(
                            cancellationToken);
                        await transaction.CommitAsync(
                            cancellationToken);

                        return Results.Json(
                            ImportResponse(
                                import,
                                recipients,
                                lockedProgram),
                            statusCode:
                                StatusCodes.Status201Created);
                    }
                    catch (DbUpdateException)
                    {
                        await transaction.RollbackAsync(
                            cancellationToken);
                        db.ChangeTracker.Clear();

                        var afterImport = await db.RecipientImports
                            .AsNoTracking()
                            .SingleOrDefaultAsync(
                                x => x.OrganizationId ==
                                        auth.Access.OrganizationId &&
                                    x.ImportKey == importKey,
                                cancellationToken);
                        if (afterImport is not null)
                        {
                            if (!ReplayMatches(
                                    afterImport,
                                    multipart.ProgramId.Value,
                                    batchFingerprint,
                                    rows.Count))
                                return Results.Conflict(new
                                {
                                    importedCount = 0,
                                    atomic = true,
                                    message =
                                        "این Idempotency-Key برای import دیگری استفاده شده است."
                                });

                            var afterRows = await db.Recipients
                                .AsNoTracking()
                                .Where(r =>
                                    r.OrganizationId ==
                                        auth.Access.OrganizationId &&
                                    r.ImportKey == importKey)
                                .OrderBy(r => r.ImportRowNumber)
                                .ToListAsync(cancellationToken);
                            if (afterRows.Count !=
                                afterImport.RowCount)
                                return Results.StatusCode(
                                    StatusCodes
                                        .Status503ServiceUnavailable);

                            return Results.Ok(
                                ImportResponse(
                                    afterImport,
                                    afterRows,
                                    lockedProgram));
                        }

                        var concurrentExisting = await db.Recipients
                            .AsNoTracking()
                            .Where(r =>
                                r.OrganizationId ==
                                    auth.Access.OrganizationId &&
                                r.ProgramId ==
                                    multipart.ProgramId.Value &&
                                r.ReferenceFingerprint != null &&
                                referenceFingerprints.Contains(
                                    r.ReferenceFingerprint))
                            .Select(r => r.ReferenceFingerprint!)
                            .ToListAsync(cancellationToken);
                        if (concurrentExisting.Count > 0)
                        {
                            var conflictSet =
                                concurrentExisting.ToHashSet(
                                    StringComparer.Ordinal);
                            return ImportErrors(
                                StatusCodes.Status409Conflict,
                                rows
                                    .Where(r =>
                                        conflictSet.Contains(
                                            r.ReferenceFingerprint))
                                    .Select(r =>
                                        new OrganizationRecipientImportError(
                                            r.RowNumber,
                                            "externalReference",
                                            "DUPLICATE_EXISTING",
                                            "این شناسه همزمان برای همین طرح ثبت شده است.")));
                        }

                        return Results.StatusCode(
                            StatusCodes.Status503ServiceUnavailable);
                    }
                }
                catch (Exception) when (
                    !cancellationToken.IsCancellationRequested)
                {
                    return Results.StatusCode(
                        StatusCodes.Status503ServiceUnavailable);
                }
            })
        .WithName("ImportOrganizationRecipients")
        .WithTags("Organization")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status413PayloadTooLarge)
        .Produces(StatusCodes.Status415UnsupportedMediaType)
        .Produces(StatusCodes.Status422UnprocessableEntity)
        .Produces(StatusCodes.Status503ServiceUnavailable);
    }
}
