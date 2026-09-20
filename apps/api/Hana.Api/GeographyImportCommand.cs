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
        if (!hasDatabase)
            throw new InvalidOperationException(
                "Geography import requires a configured database.");
        var reviewed = await ReviewedImportFile.LoadAsync(
            args, "geography", GeographyImportService.MaxDocumentBytes);

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<HanaGeographyDbContext>();
        if (!await db.Database.CanConnectAsync() ||
            (await db.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException(
                "Geography database is unavailable or migrations are pending. " +
                "Apply migrations explicitly before importing locations.");

        var result = await GeographyImportService.ImportAsync(
            db, reviewed.Json, dryRun: reviewed.DryRun,
            expectedDbStateSha256: reviewed.ExpectedDbStateSha256,
            onDbStateObserved: observed =>
                Console.WriteLine("Reviewed DB state sha256=" + observed));
        Console.WriteLine("Reviewed input sha256=" + reviewed.Sha256);
        Console.WriteLine(
            $"Geography {(reviewed.DryRun ? "PREVIEW ONLY" : "APPLIED")}: " +
            $"provinces new={result.NewProvinces}, changed={result.ChangedProvinces}; " +
            $"cities new={result.NewCities}, changed={result.ChangedCities}. " +
            "Omitted records are never deleted or withdrawn. " +
            "SELECTABLE does not enable city launch, order or delivery.");
    }
}
