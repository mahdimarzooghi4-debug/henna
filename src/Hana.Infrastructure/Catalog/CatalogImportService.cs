using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Catalog;

/// <summary>
/// Restricted out-of-band operator workflow. Never expose this as an HTTP
/// endpoint: publication is an editorial action, not seller self-service.
/// </summary>
public static partial class CatalogImportService
{
    private const int MaxRows = 1_000;
    public const int MaxDocumentBytes = 1_048_576;

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            MaxDepth = 12
        };

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidSlug();

    public static async Task<CatalogImportResult> ImportAsync(
        HanaCatalogDbContext db, string json, DateTimeOffset now,
        bool dryRun, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        if (string.IsNullOrWhiteSpace(json) ||
            System.Text.Encoding.UTF8.GetByteCount(json) > MaxDocumentBytes)
            throw new InvalidDataException("Catalog document is empty or exceeds 1 MiB.");

        CatalogImportDocument doc;
        try
        {
            doc = JsonSerializer.Deserialize<CatalogImportDocument>(
                json, JsonOptions)
                ?? throw new JsonException("Missing catalog document.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException(
                "Catalog JSON or fields are invalid; nothing imported.", ex);
        }
        var inputCategories = doc.Categories
            ?? throw new InvalidDataException("categories array is required.");
        var inputProducts = doc.Products
            ?? throw new InvalidDataException("products array is required.");
        if (inputCategories.Length > MaxRows || inputProducts.Length > MaxRows ||
            inputCategories.Length + inputProducts.Length == 0)
            throw new InvalidDataException(
                "Catalog batch must contain 1–2000 rows, max 1000 of each type.");

        var categoryIds = new HashSet<Guid>();
        var categorySlugs = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in inputCategories)
        {
            if (item is null || item.Id == Guid.Empty ||
                !ValidName(item.Name, 120) ||
                item.Slug is null || item.Slug.Length > 100 ||
                !ValidSlug().IsMatch(item.Slug) ||
                !ValidState(item.State) ||
                !categoryIds.Add(item.Id) || !categorySlugs.Add(item.Slug))
                throw new InvalidDataException(
                    "Invalid or duplicate category id/slug/name/state.");
        }

        var productIds = new HashSet<Guid>();
        var referencedCategoryIds = new HashSet<Guid>();
        foreach (var item in inputProducts)
        {
            if (item is null || item.Id == Guid.Empty ||
                item.CategoryId == Guid.Empty ||
                !ValidName(item.Name, 200) ||
                (item.Description is not null &&
                    (item.Description.Length > 2000 ||
                     ContainsControls(item.Description))) ||
                item.Kind is not (CatalogProductKinds.Good or CatalogProductKinds.Service) ||
                !ValidState(item.State) ||
                !productIds.Add(item.Id))
                throw new InvalidDataException(
                    "Invalid or duplicate product id/category/name/kind/state.");
            referencedCategoryIds.Add(item.CategoryId);
        }

        await using var transaction = dryRun ? null :
            await db.Database.BeginTransactionAsync(cancellationToken);
        if (!dryRun)
        {
            // Serialized catalog operator imports across API replicas.
            // No public writer exists; this is defense against concurrent CLI jobs.
            await db.Database.ExecuteSqlRawAsync(
                "LOCK TABLE catalog.categories, catalog.products IN SHARE ROW EXCLUSIVE MODE",
                cancellationToken);
        }

        var categories = await db.Categories
            .Where(x => categoryIds.Contains(x.Id) ||
                referencedCategoryIds.Contains(x.Id) ||
                categorySlugs.Contains(x.Slug))
            .ToListAsync(cancellationToken);
        var products = await db.Products
            .Where(x => productIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var categoriesById = categories.ToDictionary(x => x.Id);
        var productsById = products.ToDictionary(x => x.Id);

        // Reject the entire batch BEFORE mutating a tracked entity.
        foreach (var item in inputCategories)
        {
            if (categories.Any(x =>
                x.Slug == item.Slug && x.Id != item.Id))
                throw new InvalidDataException(
                    "Category slug already belongs to another category.");
        }
        foreach (var item in inputProducts)
        {
            if (!categoryIds.Contains(item.CategoryId) &&
                !categoriesById.ContainsKey(item.CategoryId))
                throw new InvalidDataException(
                    "Product references a category missing from catalog and import.");
            if (productsById.TryGetValue(item.Id, out var existing) &&
                existing.Kind != item.Kind)
                throw new InvalidDataException(
                    "Product kind is immutable for an existing catalog identity.");
        }

        var newCategories = 0;
        var changedCategories = 0;
        var newProducts = 0;
        var changedProducts = 0;
        now = now.ToUniversalTime();

        foreach (var item in inputCategories)
        {
            var name = item.Name!.Trim();
            if (!categoriesById.TryGetValue(item.Id, out var existing))
            {
                newCategories++;
                if (!dryRun)
                    db.Categories.Add(new CategoryRecord
                    {
                        Id = item.Id, Name = name, Slug = item.Slug!,
                        State = item.State!, CreatedAtUtc = now
                    });
            }
            else if (existing.Name != name ||
                     existing.Slug != item.Slug ||
                     existing.State != item.State)
            {
                changedCategories++;
                if (!dryRun)
                {
                    existing.Name = name;
                    existing.Slug = item.Slug!;
                    existing.State = item.State!;
                }
            }
        }

        foreach (var item in inputProducts)
        {
            var name = item.Name!.Trim();
            var description = item.Description?.Trim();
            if (!productsById.TryGetValue(item.Id, out var existing))
            {
                newProducts++;
                if (!dryRun)
                    db.Products.Add(new ProductRecord
                    {
                        Id = item.Id, CategoryId = item.CategoryId,
                        Name = name, Description = description,
                        Kind = item.Kind!, State = item.State!,
                        CreatedAtUtc = now
                    });
            }
            else if (existing.CategoryId != item.CategoryId ||
                     existing.Name != name ||
                     existing.Description != description ||
                     existing.State != item.State)
            {
                changedProducts++;
                if (!dryRun)
                {
                    existing.CategoryId = item.CategoryId;
                    existing.Name = name;
                    existing.Description = description;
                    existing.State = item.State!;
                }
            }
        }

        if (!dryRun)
        {
            // The applied rows and receipt are saved and committed together.
            // A failed import cannot leave a success receipt behind.
            db.ImportReceipts.Add(new CatalogImportReceipt
            {
                Id = Guid.NewGuid(),
                ContentSha256 = Convert.ToHexStringLower(
                    SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json))),
                AppliedAtUtc = now,
                NewParents = newCategories,
                ChangedParents = changedCategories,
                NewChildren = newProducts,
                ChangedChildren = changedProducts
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction!.CommitAsync(cancellationToken);
        }

        return new CatalogImportResult(
            newCategories, changedCategories, newProducts, changedProducts,
            dryRun);
    }

    private static bool ValidName(string? value, int max) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Length <= max && !ContainsControls(value);
    private static bool ContainsControls(string value) =>
        value.Any(char.IsControl);
    private static bool ValidState(string? state) =>
        state is PublicationStates.Draft or PublicationStates.Published;
}

public sealed record CatalogImportDocument(
    CatalogCategoryInput[]? Categories,
    CatalogProductInput[]? Products);

public sealed record CatalogCategoryInput(
    Guid Id, string? Name, string? Slug, string? State);

public sealed record CatalogProductInput(
    Guid Id, Guid CategoryId, string? Name,
    string? Kind, string? Description, string? State);

public sealed record CatalogImportResult(
    int NewCategories, int ChangedCategories,
    int NewProducts, int ChangedProducts, bool DryRun);
