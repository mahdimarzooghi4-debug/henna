using Hana.Infrastructure.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Hana.Infrastructure.Tests;

public sealed class CatalogModelSnapshotTests
{
    [Fact]
    public void CatalogMigrationSnapshotMatchesCurrentModel()
    {
        // Does not connect to PostgreSQL; detects drift before migrations run.
        var options = new DbContextOptionsBuilder<HanaCatalogDbContext>()
            .UseNpgsql("Host=localhost;Database=catalog_snapshot_check").Options;
        using var db = new HanaCatalogDbContext(options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var differ = db.GetService<IMigrationsModelDiffer>();
        var finalizedSnapshot = db.GetService<IModelRuntimeInitializer>()
            .Initialize(snapshot.Model, designTime: true);
        var operations = differ.GetDifferences(
            finalizedSnapshot.GetRelationalModel(),
            current.GetRelationalModel());
        var details = operations.Select(operation =>
            operation.GetType().Name + ": " +
            string.Join(", ", operation.GetType().GetProperties()
                .Where(property => property.PropertyType == typeof(string))
                .Select(property => property.Name + "=" +
                    property.GetValue(operation))));
        Assert.True(operations.Count == 0,
            "Catalog model/snapshot drift:\n" + string.Join("\n", details));
    }
}
