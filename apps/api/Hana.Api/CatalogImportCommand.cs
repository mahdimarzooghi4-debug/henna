using Hana.Application.Time;
using Hana.Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Deliberately command-line only: there is no HTTP mutation endpoint,
/// user-facing credential, fixture or default catalog publication.
/// </summary>
internal static class CatalogImportCommand
{
    internal static async Task RunAsync(
        string[] args, IServiceProvider services, bool hasDatabase)
    {
        if (args.Length != 2 ||
            args[0] is not ("--catalog-preview" or "--catalog-apply") ||
            !Path.IsPathFullyQualified(args[1]) || !hasDatabase)
            throw new InvalidOperationException(
                "Catalog import requires configured DB and exactly " +
                "--catalog-preview <absolute-json-file> or " +
                "--catalog-apply <absolute-json-file>.");

        var file = new FileInfo(args[1]);
        if (!file.Exists || file.Length is < 1 or > CatalogImportService.MaxDocumentBytes)
            throw new InvalidDataException(
                "Catalog import file is absent, empty or exceeds 1 MiB.");
        var json = await File.ReadAllTextAsync(file.FullName);
        if (System.Text.Encoding.UTF8.GetByteCount(json) >
            CatalogImportService.MaxDocumentBytes)
            throw new InvalidDataException("Catalog import file exceeds 1 MiB.");

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HanaCatalogDbContext>();
        if (!await db.Database.CanConnectAsync() ||
            (await db.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException(
                "Catalog database is unavailable or migrations are pending. " +
                "Apply migrations explicitly before catalog import.");

        var preview = args[0] == "--catalog-preview";
        var result = await CatalogImportService.ImportAsync(
            db, json,
            scope.ServiceProvider.GetRequiredService<IClock>().UtcNow,
            dryRun: preview);
        Console.WriteLine(
            $"Catalog {(preview ? "PREVIEW ONLY" : "APPLIED")}: " +
            $"categories new={result.NewCategories}, changed={result.ChangedCategories}; " +
            $"products new={result.NewProducts}, changed={result.ChangedProducts}. " +
            "Omitted records are never deleted or unpublished.");
    }
}
