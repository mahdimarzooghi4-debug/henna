using Hana.Infrastructure.Geography;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Operator-only CLI; no endpoint, automatic seed, inferred city launch or
/// secret-bearing flag. Invoke using separate reviewed input and DB env.
/// </summary>
internal static class GeographyImportCommand
{
    internal static async Task RunAsync(
        string[] args, IServiceProvider services, bool hasDatabase)
    {
        if (args.Length != 2 ||
            args[0] is not ("--geography-preview" or "--geography-apply") ||
            !Path.IsPathFullyQualified(args[1]) || !hasDatabase)
            throw new InvalidOperationException(
                "Geography import requires configured DB and exactly " +
                "--geography-preview <absolute-json-file> or " +
                "--geography-apply <absolute-json-file>.");

        var file = new FileInfo(args[1]);
        if (!file.Exists ||
            file.Length is < 1 or > GeographyImportService.MaxDocumentBytes)
            throw new InvalidDataException(
                "Geography file is absent, empty or exceeds 2 MiB.");
        var json = await File.ReadAllTextAsync(file.FullName);
        if (System.Text.Encoding.UTF8.GetByteCount(json) >
            GeographyImportService.MaxDocumentBytes)
            throw new InvalidDataException("Geography file exceeds 2 MiB.");

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<HanaGeographyDbContext>();
        if (!await db.Database.CanConnectAsync() ||
            (await db.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException(
                "Geography database is unavailable or migrations are pending. " +
                "Apply migrations explicitly before importing locations.");

        var preview = args[0] == "--geography-preview";
        var result = await GeographyImportService.ImportAsync(
            db, json, dryRun: preview);
        Console.WriteLine(
            $"Geography {(preview ? "PREVIEW ONLY" : "APPLIED")}: " +
            $"provinces new={result.NewProvinces}, changed={result.ChangedProvinces}; " +
            $"cities new={result.NewCities}, changed={result.ChangedCities}. " +
            "Omitted records are never deleted or withdrawn. " +
            "SELECTABLE does not enable city launch, order or delivery.");
    }
}
