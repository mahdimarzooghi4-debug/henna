using Hana.Infrastructure.Geography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Hana.Infrastructure.Tests;

public sealed class GeographyModelSnapshotTests
{
    [Fact]
    public void GeographyMigrationSnapshotMatchesCurrentModel()
    {
        // Detect EF drift before touching real PostgreSQL.
        var options = new DbContextOptionsBuilder<HanaGeographyDbContext>()
            .UseNpgsql("Host=localhost;Database=geo_snapshot_check").Options;
        using var db = new HanaGeographyDbContext(options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var finalizedSnapshot = db.GetService<IModelRuntimeInitializer>()
            .Initialize(snapshot.Model, designTime: true);
        var operations = db.GetService<IMigrationsModelDiffer>().GetDifferences(
            finalizedSnapshot.GetRelationalModel(),
            current.GetRelationalModel());
        var details = operations.Select(operation =>
            operation.GetType().Name + ": " +
            string.Join(", ", operation.GetType().GetProperties()
                .Where(property => property.PropertyType == typeof(string))
                .Select(property => property.Name + "=" +
                    property.GetValue(operation))));
        Assert.True(operations.Count == 0,
            "Geography model/snapshot drift:\n" + string.Join("\n", details));
    }
}
