using Hana.Application.Time;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

/// <summary>
/// Operator-only reviewed taxonomy provisioning. No HTTP writer, automatic seed
/// or default production categories are introduced.
/// </summary>
internal static class SellerBusinessCategoryImportCommand
{
    internal static async Task RunAsync(
        string[] args,
        IServiceProvider services,
        bool hasDatabase)
    {
        if (!hasDatabase)
            throw new InvalidOperationException(
                "Seller business-category import requires a configured database.");

        var reviewed = await ReviewedImportFile.LoadAsync(
            args,
            "seller-business-category",
            SellerBusinessCategoryImportService.MaxDocumentBytes);

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<HanaSellerDbContext>();

        if (!await db.Database.CanConnectAsync() ||
            (await db.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException(
                "Seller database is unavailable or migrations are pending. " +
                "Apply migrations explicitly before taxonomy import.");

        var result = await SellerBusinessCategoryImportService.ImportAsync(
            db,
            reviewed.Json,
            scope.ServiceProvider.GetRequiredService<IClock>().UtcNow,
            dryRun: reviewed.DryRun,
            expectedDbStateSha256: reviewed.ExpectedDbStateSha256,
            onDbStateObserved: observed =>
                Console.WriteLine("Reviewed DB state sha256=" + observed));

        Console.WriteLine("Reviewed input sha256=" + reviewed.Sha256);
        Console.WriteLine(
            $"Seller business categories " +
            $"{(reviewed.DryRun ? "PREVIEW ONLY" : "APPLIED")}: " +
            $"new={result.NewCategories}, changed={result.ChangedCategories}. " +
            "Omitted categories are never deleted or disabled.");
    }
}
