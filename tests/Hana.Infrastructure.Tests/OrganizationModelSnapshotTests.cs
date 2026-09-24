using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationModelSnapshotTests
{
    [Fact]
    public void OrganizationMigrationSnapshotMatchesCurrentModel()
    {
        var options = new DbContextOptionsBuilder<HanaOrganizationDbContext>()
            .UseNpgsql("Host=localhost;Database=organization_snapshot_check").Options;
        using var db = new HanaOrganizationDbContext(options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var differ = db.GetService<IMigrationsModelDiffer>();
        var finalizedSnapshot = db.GetService<IModelRuntimeInitializer>()
            .Initialize(snapshot.Model, designTime: true);
        var operations = differ.GetDifferences(
            finalizedSnapshot.GetRelationalModel(),
            current.GetRelationalModel());
        Assert.True(operations.Count == 0,
            "Organization model/snapshot drift: " +
            string.Join(", ", operations.Select(x => x is CreateIndexOperation index
                ? $"CreateIndexOperation({index.Table}.{index.Name})"
                : x.GetType().Name)));
    }
}
