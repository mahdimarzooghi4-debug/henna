using System.Data;
using System.Text;
using Hana.Infrastructure.ImportReview;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Geography;

/// <summary>
/// Offline operator-reviewed reference geography importer. SELECTABLE only
/// permits future address selection; it never enables purchases or delivery.
/// No public HTTP write endpoint or production seed is registered.
/// </summary>
public static partial class GeographyImportService
{
    public const int MaxDocumentBytes = 2_097_152;
    private const int MaxProvinces = 100;
    private const int MaxCities = 5_000;

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            MaxDepth = 12
        };

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.CultureInvariant)]
    private static partial Regex ValidSlug();

    public static async Task<GeographyImportResult> ImportAsync(
        HanaGeographyDbContext db, string json, bool dryRun,
        CancellationToken cancellationToken = default,
        string? expectedDbStateSha256 = null,
        Action<string>? onDbStateObserved = null)
    {
        ArgumentNullException.ThrowIfNull(db);
        if (string.IsNullOrWhiteSpace(json) ||
            Encoding.UTF8.GetByteCount(json) > MaxDocumentBytes)
            throw new InvalidDataException(
                "Geography document is empty or exceeds 2 MiB.");

        GeographyImportDocument doc;
        try
        {
            ReviewedImportJson.RejectDuplicateProperties(json);
            doc = JsonSerializer.Deserialize<GeographyImportDocument>(
                json, JsonOptions)
                ?? throw new JsonException("Missing geography document.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException(
                "Geography JSON or fields are invalid; nothing imported.", ex);
        }

        var inputProvinces = doc.Provinces
            ?? throw new InvalidDataException("provinces array is required.");
        var inputCities = doc.Cities
            ?? throw new InvalidDataException("cities array is required.");
        if (inputProvinces.Length > MaxProvinces ||
            inputCities.Length > MaxCities ||
            inputProvinces.Length + inputCities.Length == 0)
            throw new InvalidDataException(
                "Geography batch must contain 1–5100 rows, max 100 provinces and 5000 cities.");

        var provinceIds = new HashSet<Guid>();
        var provinceSlugs = new HashSet<string>(StringComparer.Ordinal);
        foreach (var province in inputProvinces)
        {
            if (province is null || province.Id == Guid.Empty ||
                !ValidName(province.Name) ||
                !ValidLocationSlug(province.Slug) ||
                !ValidState(province.State) ||
                !provinceIds.Add(province.Id) ||
                !provinceSlugs.Add(province.Slug!))
                throw new InvalidDataException(
                    "Invalid or duplicate province ID, slug, name or state.");
        }

        var cityIds = new HashSet<Guid>();
        var citySlugs = new HashSet<string>(StringComparer.Ordinal);
        var referencedProvinceIds = new HashSet<Guid>();
        foreach (var city in inputCities)
        {
            if (city is null || city.Id == Guid.Empty ||
                city.ProvinceId == Guid.Empty ||
                !ValidName(city.Name) ||
                !ValidLocationSlug(city.Slug) ||
                !ValidState(city.State) ||
                !cityIds.Add(city.Id) ||
                !citySlugs.Add(city.ProvinceId.ToString("N") + "/" + city.Slug))
                throw new InvalidDataException(
                    "Invalid or duplicate city ID, province, slug, name or state.");
            referencedProvinceIds.Add(city.ProvinceId);
        }

        // Repeatable preview snapshot; apply serializes operator changes.
        await using var transaction = await db.Database.BeginTransactionAsync(
            dryRun ? IsolationLevel.RepeatableRead : IsolationLevel.ReadCommitted,
            cancellationToken);
        if (!dryRun)
        {
            // Serializes concurrent operator processes, including disjoint
            // batches whose unique slug targets could otherwise race.
            await db.Database.ExecuteSqlRawAsync(
                "LOCK TABLE geography.provinces, geography.cities IN SHARE ROW EXCLUSIVE MODE",
                cancellationToken);
        }

        var provinceLookupIds = provinceIds
            .Concat(referencedProvinceIds).Distinct().ToArray();
        var importedCitySlugs = inputCities.Select(x => x.Slug!).ToArray();
        var importedCityIds = cityIds.ToArray();
        var provinces = await db.Provinces
            .Where(x => provinceLookupIds.Contains(x.Id) ||
                provinceSlugs.Contains(x.Slug))
            .ToListAsync(cancellationToken);
        var cities = await db.Cities
            .Where(x => importedCityIds.Contains(x.Id) ||
                (referencedProvinceIds.Contains(x.ProvinceId) &&
                 importedCitySlugs.Contains(x.Slug)))
            .ToListAsync(cancellationToken);
        var provincesById = provinces.ToDictionary(x => x.Id);
        var citiesById = cities.ToDictionary(x => x.Id);

        // Same scoped identity/province/slug lookup at preview and apply.
        // Sorted persisted values prevent query or row order from changing
        // the digest; this digest is NOT proof of city launch readiness.
        var dbState = ImportStateChecksum.Compute(new
        {
            provinces = provinces.OrderBy(x => x.Id)
                .Select(x => new
                {
                    x.Id, x.Name, x.Slug, x.State
                }).ToArray(),
            cities = cities.OrderBy(x => x.Id)
                .Select(x => new
                {
                    x.Id, x.ProvinceId, x.Name, x.Slug, x.State
                }).ToArray()
        });

        // Finish all validation before adding or mutating EF tracked rows.
        foreach (var province in inputProvinces)
        {
            if (provinces.Any(x =>
                x.Slug == province.Slug && x.Id != province.Id))
                throw new InvalidDataException(
                    "Province slug already belongs to another province.");
        }
        foreach (var city in inputCities)
        {
            if (!provinceIds.Contains(city.ProvinceId) &&
                !provincesById.ContainsKey(city.ProvinceId))
                throw new InvalidDataException(
                    "City references a province absent from registry and import.");
            if (citiesById.TryGetValue(city.Id, out var existing) &&
                existing.ProvinceId != city.ProvinceId)
                throw new InvalidDataException(
                    "City identity cannot be reassigned to another province.");
            if (cities.Any(x => x.ProvinceId == city.ProvinceId &&
                x.Slug == city.Slug && x.Id != city.Id))
                throw new InvalidDataException(
                    "City slug already belongs to another city in this province.");
        }

        if (!dryRun)
            ImportStateChecksum.RequireMatch(
                expectedDbStateSha256, dbState);
        onDbStateObserved?.Invoke(dbState);

        var newProvinces = 0;
        var changedProvinces = 0;
        var newCities = 0;
        var changedCities = 0;
        foreach (var province in inputProvinces)
        {
            var name = province.Name!.Trim();
            if (!provincesById.TryGetValue(province.Id, out var existing))
            {
                newProvinces++;
                if (!dryRun)
                    db.Provinces.Add(new ProvinceRecord
                    {
                        Id = province.Id, Name = name, Slug = province.Slug!,
                        State = province.State!
                    });
            }
            else if (existing.Name != name ||
                     existing.Slug != province.Slug ||
                     existing.State != province.State)
            {
                changedProvinces++;
                if (!dryRun)
                {
                    existing.Name = name;
                    existing.Slug = province.Slug!;
                    existing.State = province.State!;
                }
            }
        }

        foreach (var city in inputCities)
        {
            var name = city.Name!.Trim();
            if (!citiesById.TryGetValue(city.Id, out var existing))
            {
                newCities++;
                if (!dryRun)
                    db.Cities.Add(new CityRecord
                    {
                        Id = city.Id, ProvinceId = city.ProvinceId,
                        Name = name, Slug = city.Slug!,
                        State = city.State!
                    });
            }
            else if (existing.Name != name ||
                     existing.Slug != city.Slug ||
                     existing.State != city.State)
            {
                changedCities++;
                if (!dryRun)
                {
                    existing.Name = name;
                    existing.Slug = city.Slug!;
                    existing.State = city.State!;
                }
            }
        }

        if (!dryRun)
        {
            // The applied rows and receipt are saved and committed together.
            // A failed import cannot leave a success receipt behind.
            db.ImportReceipts.Add(new GeographyImportReceipt
            {
                Id = Guid.NewGuid(),
                ContentSha256 = Convert.ToHexStringLower(
                    SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json))),
                AppliedAtUtc = DateTimeOffset.UtcNow,
                NewParents = newProvinces,
                ChangedParents = changedProvinces,
                NewChildren = newCities,
                ChangedChildren = changedCities
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        return new GeographyImportResult(
            newProvinces, changedProvinces, newCities, changedCities, dryRun);
    }

    private static bool ValidName(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= 120 &&
        !value.Any(char.IsControl);

    private static bool ValidLocationSlug(string? slug) =>
        slug is { Length: >= 1 and <= 100 } &&
        ValidSlug().IsMatch(slug);

    private static bool ValidState(string? state) =>
        state is GeographyStates.Draft or GeographyStates.Selectable;
}

public sealed record GeographyImportDocument(
    GeographyProvinceInput[]? Provinces,
    GeographyCityInput[]? Cities);

public sealed record GeographyProvinceInput(
    Guid Id, string? Name, string? Slug, string? State);

public sealed record GeographyCityInput(
    Guid Id, Guid ProvinceId, string? Name, string? Slug, string? State);

public sealed record GeographyImportResult(
    int NewProvinces, int ChangedProvinces,
    int NewCities, int ChangedCities, bool DryRun);
