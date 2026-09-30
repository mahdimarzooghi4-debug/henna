using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class SellerBusinessCategoryImportTests
{
    [Fact]
    public async Task PreviewAndApplyAreBoundToReviewedDbState()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var options = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var db = new HanaSellerDbContext(options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var json = $$"""
        {
          "categories": [
            {
              "id": "{{firstId}}",
              "name": "دسته‌بندی وارداتی الف",
              "isActive": true
            },
            {
              "id": "{{secondId}}",
              "name": "دسته‌بندی وارداتی ب",
              "isActive": false
            }
          ]
        }
        """;

        string? observed = null;
        var preview = await SellerBusinessCategoryImportService.ImportAsync(
            db,
            json,
            DateTimeOffset.UtcNow,
            dryRun: true,
            onDbStateObserved: value => observed = value);

        Assert.NotNull(observed);
        Assert.Equal(2, preview.NewCategories);
        Assert.Equal(0, preview.ChangedCategories);
        Assert.True(preview.DryRun);
        Assert.False(await db.BusinessCategories.AnyAsync(
            x => x.Id == firstId || x.Id == secondId));
        Assert.False(await db.BusinessCategoryImportReceipts.AnyAsync(
            x => x.NewCategories == 2));

        var appliedAt = DateTimeOffset.UtcNow;
        var applied = await SellerBusinessCategoryImportService.ImportAsync(
            db,
            json,
            appliedAt,
            dryRun: false,
            expectedDbStateSha256: observed);

        Assert.Equal(2, applied.NewCategories);
        Assert.Equal(0, applied.ChangedCategories);
        Assert.False(applied.DryRun);

        var rows = await db.BusinessCategories.AsNoTracking()
            .Where(x => x.Id == firstId || x.Id == secondId)
            .OrderBy(x => x.Name)
            .ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.True(rows.Single(x => x.Id == firstId).IsActive);
        Assert.False(rows.Single(x => x.Id == secondId).IsActive);

        var receipt = await db.BusinessCategoryImportReceipts.AsNoTracking()
            .OrderByDescending(x => x.AppliedAtUtc)
            .FirstAsync(x => x.NewCategories == 2);
        Assert.Equal(64, receipt.ContentSha256.Length);
        Assert.Equal(2, receipt.NewCategories);
        Assert.Equal(0, receipt.ChangedCategories);

        var changeJson = $$"""
        {
          "categories": [
            {
              "id": "{{firstId}}",
              "name": "دسته‌بندی وارداتی الف",
              "isActive": false
            }
          ]
        }
        """;

        string? changeState = null;
        var changePreview =
            await SellerBusinessCategoryImportService.ImportAsync(
                db,
                changeJson,
                DateTimeOffset.UtcNow,
                dryRun: true,
                onDbStateObserved: value => changeState = value);
        Assert.Equal(0, changePreview.NewCategories);
        Assert.Equal(1, changePreview.ChangedCategories);
        Assert.NotNull(changeState);

        await db.BusinessCategories
            .Where(x => x.Id == firstId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.UpdatedAtUtc, DateTimeOffset.UtcNow.AddMinutes(1)));

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            SellerBusinessCategoryImportService.ImportAsync(
                db,
                changeJson,
                DateTimeOffset.UtcNow,
                dryRun: false,
                expectedDbStateSha256: changeState));
        Assert.True((await db.BusinessCategories.AsNoTracking()
            .SingleAsync(x => x.Id == firstId)).IsActive);
    }

    [Fact]
    public async Task AmbiguousOrDuplicateTaxonomyIsRejectedBeforeMutation()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var options = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;
        await using var db = new HanaSellerDbContext(options);

        var id = Guid.NewGuid();
        var duplicateProperty = $$"""
        {
          "categories": [
            {
              "id": "{{id}}",
              "name": "الف",
              "name": "ب",
              "isActive": true
            }
          ]
        }
        """;
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            SellerBusinessCategoryImportService.ImportAsync(
                db,
                duplicateProperty,
                DateTimeOffset.UtcNow,
                dryRun: true));

        var duplicateName = $$"""
        {
          "categories": [
            {
              "id": "{{Guid.NewGuid()}}",
              "name": "نام تکراری",
              "isActive": true
            },
            {
              "id": "{{Guid.NewGuid()}}",
              "name": "نام تکراری",
              "isActive": true
            }
          ]
        }
        """;
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            SellerBusinessCategoryImportService.ImportAsync(
                db,
                duplicateName,
                DateTimeOffset.UtcNow,
                dryRun: true));
    }
}
