using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hana.Application.Time;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class CatalogMediaEndpoints
{
    private const int MaxMultipartBytes = CatalogMediaStorageLimits.MaxImageBytes + 64 * 1024;
    private static readonly JsonSerializerOptions ReviewJsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            MaxDepth = 4
        };

    internal static void MapCatalogMedia(this WebApplication app, bool hasDatabase)
    {
        app.MapPost("/api/v1/admin/catalog/products/{productId:guid}/media",
            (Guid productId, HttpRequest request, HttpContext context,
                IServiceProvider services, CancellationToken cancellationToken) =>
                UploadAsync(productId, request, context, services, hasDatabase,
                    cancellationToken))
            .WithName("UploadCatalogProductMedia")
            .WithTags("Admin");

        app.MapPost("/api/v1/admin/catalog/media/{assetId:guid}/review",
            (Guid assetId, HttpRequest request, HttpContext context,
                IServiceProvider services, CancellationToken cancellationToken) =>
                ReviewAsync(assetId, request, context, services, hasDatabase,
                    cancellationToken))
            .WithName("ReviewCatalogMedia")
            .WithTags("Admin");

        app.MapGet("/api/v1/catalog/media/{assetId:guid}",
            (Guid assetId, HttpContext context, IServiceProvider services,
                CancellationToken cancellationToken) =>
                ReadAsync(assetId, context, services, hasDatabase,
                    cancellationToken))
            .WithName("GetApprovedCatalogMedia")
            .WithTags("Catalog");
    }

    private static async Task<IResult> UploadAsync(
        Guid productId, HttpRequest request, HttpContext context,
        IServiceProvider services, bool hasDatabase,
        CancellationToken cancellationToken)
    {
        NoStore(context);
        if (!request.IsHttps && !context.RequestServices
            .GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        var auth = await AuthorizeAdminAsync(
            context, services, hasDatabase, cancellationToken);
        if (auth.Error is not null) return auth.Error;
        if (auth.AccountId is null)
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        if (!hasDatabase)
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        if (productId == Guid.Empty)
            return Results.NotFound();

        var storage = services.GetService<ICatalogMediaStorage>();
        if (storage is null)
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        if (request.Query.Count != 0 || !request.HasFormContentType ||
            request.ContentLength is > MaxMultipartBytes)
            return Results.BadRequest(new { message = "درخواست تصویر معتبر نیست." });

        var uploadKeyText = context.Request.Headers["Idempotency-Key"].ToString();
        if (!Guid.TryParse(uploadKeyText, out var uploadKey) ||
            uploadKey == Guid.Empty)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["کلید بارگذاری معتبر نیست."]
            });

        try
        {
            var db = services.GetRequiredService<HanaCatalogDbContext>();
            if (!await db.Products.AsNoTracking().AnyAsync(
                p => p.Id == productId, cancellationToken))
                return Results.NotFound();

            var form = await request.ReadFormAsync(cancellationToken);
            if (form.Count != 0 || form.Files.Count != 1 ||
                form.Files[0].Name != "image" ||
                form.Files[0].Length is < 1 or > CatalogMediaStorageLimits.MaxImageBytes)
                return Results.BadRequest(new { message = "فایل تصویر معتبر نیست." });

            var file = form.Files[0];
            await using var input = file.OpenReadStream();
            var bytes = new byte[CatalogMediaStorageLimits.MaxImageBytes + 1];
            var length = 0;
            while (length < bytes.Length)
            {
                var read = await input.ReadAsync(bytes.AsMemory(length), cancellationToken);
                if (read == 0) break;
                length += read;
            }
            if (length == 0 || length > CatalogMediaStorageLimits.MaxImageBytes ||
                length != file.Length)
                return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
            Array.Resize(ref bytes, length);

            if (!TryImageType(bytes, out var contentType, out var extension))
                return Results.BadRequest(new
                {
                    message = "فقط تصویر JPEG، PNG یا WebP پذیرفته می‌شود."
                });

            var digest = Convert.ToHexString(SHA256.HashData(bytes))
                .ToLowerInvariant();
            var existing = await db.MediaAssets.AsNoTracking()
                .SingleOrDefaultAsync(x =>
                    x.UploadedByAccountId == auth.AccountId.Value &&
                    x.UploadIdempotencyKey == uploadKey,
                    cancellationToken);
            if (existing is not null)
                return existing.ProductId == productId &&
                    existing.ContentSha256 == digest
                    ? Results.Ok(UploadResponse(existing))
                    : Results.Conflict(new
                    {
                        message = "کلید بارگذاری قبلاً برای محتوای دیگری استفاده شده است."
                    });

            var objectSeed = $"{auth.AccountId.Value:N}:{uploadKey:N}:{digest}";
            var objectToken = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(objectSeed)))
                .ToLowerInvariant();
            var objectKey = $"catalog/{productId:N}/{objectToken}.{extension}";
            await storage.PutAsync(objectKey, contentType, bytes, cancellationToken);

            var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
            var record = new CatalogMediaAssetRecord
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                ObjectKey = objectKey,
                ContentType = contentType,
                ContentSha256 = digest,
                LengthBytes = length,
                ReviewStatus = CatalogMediaReviewStates.Pending,
                Revision = 1,
                UploadedByAccountId = auth.AccountId.Value,
                UploadIdempotencyKey = uploadKey,
                UploadedAtUtc = now
            };
            db.MediaAssets.Add(record);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(UploadResponse(record));
            }
            catch (DbUpdateException)
            {
                var replay = await db.MediaAssets.AsNoTracking()
                    .SingleOrDefaultAsync(x =>
                        x.UploadedByAccountId == auth.AccountId.Value &&
                        x.UploadIdempotencyKey == uploadKey,
                        cancellationToken);
                if (replay is not null && replay.ProductId == productId &&
                    replay.ContentSha256 == digest)
                    return Results.Ok(UploadResponse(replay));
                return Results.Conflict(new
                {
                    message = "درخواست هم‌زمان با همین کلید ثبت شده است."
                });
            }
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ReviewAsync(
        Guid assetId, HttpRequest request, HttpContext context,
        IServiceProvider services, bool hasDatabase,
        CancellationToken cancellationToken)
    {
        NoStore(context);
        if (!request.IsHttps && !context.RequestServices
            .GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        var auth = await AuthorizeAdminAsync(
            context, services, hasDatabase, cancellationToken);
        if (auth.Error is not null) return auth.Error;
        if (auth.AccountId is null)
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        if (!hasDatabase || assetId == Guid.Empty)
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        if (request.Query.Count != 0 || request.ContentLength is > 4096 ||
            request.ContentType is null ||
            !request.ContentType.StartsWith("application/json",
                StringComparison.OrdinalIgnoreCase))
            return Results.BadRequest(new { message = "درخواست بازبینی معتبر نیست." });

        var keyHeader = context.Request.Headers["Idempotency-Key"].ToString();
        if (!Guid.TryParse(keyHeader, out var reviewKey) || reviewKey == Guid.Empty)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["کلید بازبینی معتبر نیست."]
            });

        CatalogMediaReviewInput? input;
        try
        {
            input = await JsonSerializer.DeserializeAsync<CatalogMediaReviewInput>(
                request.Body, ReviewJsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            return Results.BadRequest(new { message = "بدنهٔ بازبینی معتبر نیست." });
        }
        if (input is null || input.Revision < 1 || input.Revision == int.MaxValue ||
            (input.Decision != "APPROVED" && input.Decision != "REJECTED") ||
            (input.Decision == "REJECTED" &&
                string.IsNullOrWhiteSpace(input.Reason)) ||
            ((input.Reason?.Length ?? 0) > 1000))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["review"] = ["تصمیم، دلیل یا نسخهٔ بازبینی معتبر نیست."]
            });

        try
        {
            var db = services.GetRequiredService<HanaCatalogDbContext>();
            var normalizedReason = input.Reason?.Trim();
            if (input.Decision == "REJECTED" &&
                string.IsNullOrWhiteSpace(normalizedReason))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["reason"] = ["دلیل رد الزامی است."]
                });

            var prior = await db.MediaReviews.AsNoTracking()
                .SingleOrDefaultAsync(x => x.IdempotencyKey == reviewKey,
                    cancellationToken);
            if (prior is not null)
            {
                var compatible = prior.AssetId == assetId &&
                    prior.ExpectedRevision == input.Revision &&
                    prior.Decision == input.Decision &&
                    prior.Reason == normalizedReason &&
                    prior.ReviewedByAccountId == auth.AccountId.Value;
                if (!compatible)
                    return Results.Conflict(new
                    {
                        message = "کلید بازبینی قبلاً برای درخواست دیگری استفاده شده است."
                    });
                var replayAsset = await db.MediaAssets.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == assetId, cancellationToken);
                return replayAsset is null
                    ? Results.NotFound()
                    : Results.Ok(ReviewResponse(replayAsset));
            }

            var target = await db.MediaAssets.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == assetId, cancellationToken);
            if (target is null) return Results.NotFound();

            await using var transaction = await db.Database
                .BeginTransactionAsync(cancellationToken);
            var now = services.GetRequiredService<IClock>().UtcNow.ToUniversalTime();
            var changed = await db.MediaAssets
                .Where(x => x.Id == assetId &&
                    x.ReviewStatus == CatalogMediaReviewStates.Pending &&
                    x.Revision == input.Revision)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.ReviewStatus, input.Decision)
                    .SetProperty(x => x.Revision, input.Revision + 1)
                    .SetProperty(x => x.ReviewedByAccountId, auth.AccountId.Value)
                    .SetProperty(x => x.ReviewedAtUtc, now)
                    .SetProperty(x => x.ReviewReason, normalizedReason),
                    cancellationToken);
            if (changed != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                var current = await db.MediaAssets.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == assetId, cancellationToken);
                return current is null
                    ? Results.NotFound()
                    : Results.Conflict(new
                    {
                        message = "تصویر تغییر کرده یا دیگر منتظر بازبینی نیست.",
                        currentRevision = current.Revision,
                        reviewStatus = current.ReviewStatus
                    });
            }

            if (input.Decision == "APPROVED")
            {
                await db.Products.Where(x => x.Id == target.ProductId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.PrimaryMediaAssetId, assetId),
                        cancellationToken);
            }

            db.MediaReviews.Add(new CatalogMediaReviewRecord
            {
                Id = Guid.NewGuid(),
                AssetId = assetId,
                ExpectedRevision = input.Revision,
                Decision = input.Decision,
                Reason = normalizedReason,
                ReviewedByAccountId = auth.AccountId.Value,
                IdempotencyKey = reviewKey,
                ReviewedAtUtc = now
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var updated = await db.MediaAssets.AsNoTracking()
                .SingleAsync(x => x.Id == assetId, cancellationToken);
            return Results.Ok(ReviewResponse(updated));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ReadAsync(
        Guid assetId, HttpContext context, IServiceProvider services,
        bool hasDatabase, CancellationToken cancellationToken)
    {
        NoStore(context);
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (assetId == Guid.Empty)
            return Results.NotFound();
        if (!hasDatabase)
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        var storage = services.GetService<ICatalogMediaStorage>();
        if (storage is null)
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        try
        {
            var db = services.GetRequiredService<HanaCatalogDbContext>();
            var asset = await db.MediaAssets.AsNoTracking()
                .Where(x => x.Id == assetId &&
                    x.ReviewStatus == CatalogMediaReviewStates.Approved &&
                    x.Product.PrimaryMediaAssetId == x.Id &&
                    x.Product.State == PublicationStates.Published &&
                    x.Product.Category.State == PublicationStates.Published)
                .Select(x => new { x.ObjectKey, x.ContentType, x.ContentSha256 })
                .SingleOrDefaultAsync(cancellationToken);
            if (asset is null)
                return Results.NotFound();

            var bytes = await storage.ReadAsync(asset.ObjectKey, cancellationToken);
            if (bytes is null || bytes.Length > CatalogMediaStorageLimits.MaxImageBytes ||
                Convert.ToHexString(SHA256.HashData(bytes))
                    .ToLowerInvariant() != asset.ContentSha256)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

            context.Response.Headers["ETag"] = $"\"{asset.ContentSha256}\"";
            return Results.File(bytes, asset.ContentType);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static bool TryImageType(
        byte[] bytes, out string contentType, out string extension)
    {
        if (bytes.Length >= 8 &&
            bytes.AsSpan(0, 8).SequenceEqual(
                new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
        {
            contentType = "image/png";
            extension = "png";
            return true;
        }
        if (bytes.Length >= 3 && bytes[0] == 0xff &&
            bytes[1] == 0xd8 && bytes[2] == 0xff)
        {
            contentType = "image/jpeg";
            extension = "jpg";
            return true;
        }
        if (bytes.Length >= 12 &&
            bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) &&
            bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            contentType = "image/webp";
            extension = "webp";
            return true;
        }
        contentType = "";
        extension = "";
        return false;
    }

    private static object UploadResponse(CatalogMediaAssetRecord x) => new
    {
        assetId = x.Id, productId = x.ProductId, x.Revision,
        reviewStatus = x.ReviewStatus, sha256 = x.ContentSha256,
        lengthBytes = x.LengthBytes
    };

    private static object ReviewResponse(CatalogMediaAssetRecord x) => new
    {
        assetId = x.Id, productId = x.ProductId, x.Revision,
        reviewStatus = x.ReviewStatus, x.ReviewedAtUtc,
        imageUrl = x.ReviewStatus == CatalogMediaReviewStates.Approved
            ? $"/api/v1/catalog/media/{x.Id:D}" : null
    };

    private static void NoStore(HttpContext context) =>
        context.Response.Headers.CacheControl = "no-store";

    private static async Task<(Guid? AccountId, IResult? Error)>
        AuthorizeAdminAsync(
            HttpContext context, IServiceProvider services,
            bool hasDatabase, CancellationToken cancellationToken)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return (null, Results.Unauthorized());
        var token = header[7..];
        if (!SessionTokenCodec.TryComputeDigest(token, out _))
            return (null, Results.Unauthorized());
        if (!hasDatabase)
            return (null, Results.StatusCode(
                StatusCodes.Status503ServiceUnavailable));

        var sessions = services.GetRequiredService<AuthSessionService>();
        var accountId = await sessions.ResolveAccountAsync(token, cancellationToken);
        if (accountId is null) return (null, Results.Unauthorized());

        var roles = services.GetRequiredService<RoleAuthorizationService>();
        return await roles.HasRoleAsync(accountId.Value, HanaRoles.Admin,
            cancellationToken)
            ? (accountId, null)
            : (null, Results.StatusCode(StatusCodes.Status403Forbidden));
    }
}

internal sealed record CatalogMediaReviewInput(
    int Revision, string Decision, string? Reason);
