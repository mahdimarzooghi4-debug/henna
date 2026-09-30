using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Hana.Infrastructure.Tests;

public sealed class OrganizationModelSnapshotTests
{
    [Fact]
    public void OrganizationMigrationSnapshotMatchesCurrentModel()
    {
        var options = new DbContextOptionsBuilder<HanaOrganizationDbContext>()
            .UseNpgsql("Host=localhost;Database=organization_snapshot_check", pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "organization"))
            .Options;
        using var db = new HanaOrganizationDbContext(options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);
        var current = db.GetService<IDesignTimeModel>().Model;
        var finalizedSnapshot = db.GetService<IModelRuntimeInitializer>().Initialize(snapshot.Model, designTime: true);
        var operations = db.GetService<IMigrationsModelDiffer>().GetDifferences(finalizedSnapshot.GetRelationalModel(), current.GetRelationalModel());
        Assert.Empty(operations);
    }
}
