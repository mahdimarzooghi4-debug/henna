using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hana.Infrastructure.ImportReview;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Seller;

/// <summary>
/// Operator-only reviewed taxonomy import. Never expose as seller self-service
/// or an HTTP mutation endpoint.
/// </summary>
public static class SellerBusinessCategoryImportService
{
    private const int MaxRows = 500;
    public const int MaxDocumentBytes = 262_144;

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            MaxDepth = 8
        };

    public static async Task<SellerBusinessCategoryImportResult> ImportAsync(
        HanaSellerDbContext db,
        string json,
        DateTimeOffset now,
        bool dryRun,
        CancellationToken cancellationToken = default,
        string? expectedDbStateSha256 = null,
        Action<string>? onDbStateObserved = null)
    {
        ArgumentNullException.ThrowIfNull(db);
        if (string.IsNullOrWhiteSpace(json) ||
            Encoding.UTF8.GetByteCount(json) > MaxDocumentBytes)
            throw new InvalidDataException(
                "Seller business-category document is empty or exceeds 256 KiB.");

        SellerBusinessCategoryImportDocument doc;
        try
        {
            ReviewedImportJson.RejectDuplicateProperties(json);
            doc = JsonSerializer.Deserialize<SellerBusinessCategoryImportDocument>(
                json, JsonOptions)
                ?? throw new JsonException("Missing seller business-category document.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException(
                "Seller business-category JSON or fields are invalid; nothing imported.",
                ex);
        }

        var input = doc.Categories
            ?? throw new InvalidDataException("categories array is required.");
        if (input.Length is < 1 or > MaxRows)
            throw new InvalidDataException(
                "Seller business-category batch must contain 1–500 rows.");

        var ids = new HashSet<Guid>();
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in input)
        {
            var name = item?.Name?.Trim();
            if (item is null || item.Id == Guid.Empty ||
                string.IsNullOrWhiteSpace(name) ||
                name.Length > 120 ||
                name.Any(char.IsControl) ||
                !ids.Add(item.Id) ||
                item.IsActive is null ||
                !names.Add(name))
                throw new InvalidDataException(
                    "Invalid or duplicate seller business category id/name.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(
            dryRun ? IsolationLevel.RepeatableRead : IsolationLevel.ReadCommitted,
            cancellationToken);

        if (!dryRun)
        {
            await db.Database.ExecuteSqlRawAsync(
                "LOCK TABLE seller.business_categories, " +
                "seller.business_category_import_receipts " +
                "IN SHARE ROW EXCLUSIVE MODE",
                cancellationToken);
        }

        // Always hash the committed database state, not an entity already
        // cached by this DbContext during a previous dry-run preview.
        var existing = await db.BusinessCategories.AsNoTracking()
            .Where(x => ids.Contains(x.Id) || names.Contains(x.Name))
            .ToListAsync(cancellationToken);

        foreach (var item in input)
        {
            var name = item!.Name!.Trim();
            if (existing.Any(x => x.Name == name && x.Id != item.Id))
                throw new InvalidDataException(
                    "Seller business category name belongs to another identity.");
        }

        var dbState = ImportStateChecksum.Compute(
            existing.OrderBy(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.IsActive,
                    x.UpdatedAtUtc
                }).ToArray());

        if (!dryRun)
            ImportStateChecksum.RequireMatch(expectedDbStateSha256, dbState);
        onDbStateObserved?.Invoke(dbState);

        var byId = existing.ToDictionary(x => x.Id);
        var newCategories = 0;
        var changedCategories = 0;
        now = now.ToUniversalTime();

        foreach (var item in input)
        {
            var name = item!.Name!.Trim();
            if (!byId.TryGetValue(item.Id, out var current))
            {
                newCategories++;
                if (!dryRun)
                    db.BusinessCategories.Add(new SellerBusinessCategoryRecord
                    {
                        Id = item.Id,
                        Name = name,
                        IsActive = item.IsActive.Value,
                        UpdatedAtUtc = now
                    });
                continue;
            }

            if (current.Name == name && current.IsActive == item.IsActive.Value)
                continue;

            changedCategories++;
            if (!dryRun)
            {
                current.Name = name;
                current.IsActive = item.IsActive.Value;
                current.UpdatedAtUtc = now;
                db.BusinessCategories.Update(current);
            }
        }

        if (!dryRun)
        {
            db.BusinessCategoryImportReceipts.Add(
                new SellerBusinessCategoryImportReceipt
                {
                    Id = Guid.NewGuid(),
                    ContentSha256 = Convert.ToHexStringLower(
                        SHA256.HashData(Encoding.UTF8.GetBytes(json))),
                    AppliedAtUtc = now,
                    NewCategories = newCategories,
                    ChangedCategories = changedCategories
                });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        return new SellerBusinessCategoryImportResult(
            newCategories, changedCategories, dryRun);
    }
}

public sealed record SellerBusinessCategoryImportDocument(
    SellerBusinessCategoryImportItem[]? Categories);

public sealed record SellerBusinessCategoryImportItem(
    Guid Id,
    string? Name,
    bool? IsActive);

public sealed record SellerBusinessCategoryImportResult(
    int NewCategories,
    int ChangedCategories,
    bool DryRun);
