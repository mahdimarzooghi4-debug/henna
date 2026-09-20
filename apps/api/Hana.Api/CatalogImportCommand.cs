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
        if (!hasDatabase)
            throw new InvalidOperationException(
                "Catalog import requires a configured database.");
        var reviewed = await ReviewedImportFile.LoadAsync(
            args, "catalog", CatalogImportService.MaxDocumentBytes);

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HanaCatalogDbContext>();
        if (!await db.Database.CanConnectAsync() ||
            (await db.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException(
                "Catalog database is unavailable or migrations are pending. " +
                "Apply migrations explicitly before catalog import.");

        var result = await CatalogImportService.ImportAsync(
            db, reviewed.Json,
            scope.ServiceProvider.GetRequiredService<IClock>().UtcNow,
            dryRun: reviewed.DryRun);
        Console.WriteLine("Reviewed input sha256=" + reviewed.Sha256);
        Console.WriteLine(
            $"Catalog {(reviewed.DryRun ? "PREVIEW ONLY" : "APPLIED")}: " +
            $"categories new={result.NewCategories}, changed={result.ChangedCategories}; " +
            $"products new={result.NewProducts}, changed={result.ChangedProducts}. " +
            "Omitted records are never deleted or unpublished.");
    }
}
