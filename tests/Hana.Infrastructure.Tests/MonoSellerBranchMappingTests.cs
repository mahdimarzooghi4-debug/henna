using System.Security.Cryptography;
using Hana.Application.Time;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.External;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class MonoSellerBranchMappingTests
{
    [Fact]
    public async Task MappingRequiresActiveHennaSellerAndActiveMonoOwnedBranch()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        await using var commerce = CommerceContext(connection);
        await using var sellers = SellerContext(connection);
        await using var identity = IdentityContext(connection);
        await commerce.Database.MigrateAsync();
        await sellers.Database.MigrateAsync();
        await identity.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var sellerId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var activeBranchId = "br_0123456789abcdef0123456789abcdef";
        var secondActiveBranchId = "br_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        var inactiveBranchId = "br_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        identity.Accounts.Add(Account(sellerId, now));
        await identity.SaveChangesAsync();
        sellers.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = sellerId, StoreName = "CI", OwnerName = "CI", Phone = identity.Accounts.Local.Single().NormalizedPhone,
            City = "CI", Address = "CI", PostalCode = "1234567890", UpdatedAtUtc = now
        });
        sellers.SellerActivations.Add(new SellerActivationRecord
        {
            Id = Guid.NewGuid(), ApplicationAccountId = sellerId,
            ActivatedByAccountId = adminId, ActivationKey = Guid.NewGuid(),
            ExpectedRevision = 1, CreatedAtUtc = now
        });
        await sellers.SaveChangesAsync();

        var client = new StubMonoClient(new MonoBranchList([
            new(activeBranchId, "Active test branch", null, null, null, null, "ACTIVE"),
            new(secondActiveBranchId, "Second active test branch", null, null, null, null, "ACTIVE"),
            new(inactiveBranchId, "Inactive test branch", null, null, null, null, "SUSPENDED")
        ]));
        var service = new MonoSellerBranchMappingService(commerce, sellers, client, new TestClock(now));

        var first = await service.SetAsync(sellerId, activeBranchId, adminId, 0);
        var replay = await service.SetAsync(sellerId, activeBranchId, adminId, 0);
        Assert.Equal(1, first.Revision);
        Assert.Equal(first, replay);
        Assert.Equal(activeBranchId, (await service.FindAsync(sellerId))?.MonoBranchId);
        Assert.Single(await commerce.Journal.Where(item => item.Event == "MONO_SELLER_BRANCH_MAPPED"
            && item.ActorId == adminId && item.ResourceId == sellerId).ToListAsync());

        var inactive = await Assert.ThrowsAsync<MonoSellerBranchMappingException>(() =>
            service.SetAsync(sellerId, inactiveBranchId, adminId, 1));
        Assert.Equal("MONO_BRANCH_NOT_ACTIVE_OR_NOT_OWNED", inactive.Code);
        var stale = await Assert.ThrowsAsync<MonoSellerBranchMappingException>(() =>
            service.SetAsync(sellerId, secondActiveBranchId, adminId, 0));
        Assert.Equal("MAPPING_REVISION_CONFLICT", stale.Code);
        Assert.Equal(1, (await service.FindAsync(sellerId))?.Revision);
    }

    [Fact]
    public async Task MappingRejectsSellerWithoutActivationOrWithOpenSuspension()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        await using var commerce = CommerceContext(connection);
        await using var sellers = SellerContext(connection);
        await using var identity = IdentityContext(connection);
        await commerce.Database.MigrateAsync();
        await sellers.Database.MigrateAsync();
        await identity.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var sellerId = Guid.NewGuid();
        var inactiveSeller = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        identity.Accounts.AddRange(Account(sellerId, now), Account(inactiveSeller, now));
        await identity.SaveChangesAsync();
        sellers.RegistrationDrafts.AddRange(
            Draft(sellerId, now), Draft(inactiveSeller, now));
        sellers.SellerActivations.Add(new SellerActivationRecord
        {
            Id = Guid.NewGuid(), ApplicationAccountId = sellerId,
            ActivatedByAccountId = adminId, ActivationKey = Guid.NewGuid(),
            ExpectedRevision = 1, CreatedAtUtc = now
        });
        sellers.SellerSuspensions.Add(new SellerSuspensionRecord
        {
            Id = Guid.NewGuid(), ApplicationAccountId = sellerId,
            SuspendedByAccountId = adminId, SuspensionKey = Guid.NewGuid(),
            ExpectedRevision = 1, Reason = "CI test suspension", CreatedAtUtc = now
        });
        await sellers.SaveChangesAsync();

        var client = new StubMonoClient(new MonoBranchList([
            new("br_0123456789abcdef0123456789abcdef", "Active", null, null, null, null, "ACTIVE")
        ]));
        var service = new MonoSellerBranchMappingService(commerce, sellers, client, new TestClock(now));
        var branch = "br_0123456789abcdef0123456789abcdef";

        var suspended = await Assert.ThrowsAsync<MonoSellerBranchMappingException>(() =>
            service.SetAsync(sellerId, branch, adminId, 0));
        var unapproved = await Assert.ThrowsAsync<MonoSellerBranchMappingException>(() =>
            service.SetAsync(inactiveSeller, branch, adminId, 0));
        Assert.Equal("SELLER_NOT_ACTIVE", suspended.Code);
        Assert.Equal("SELLER_NOT_ACTIVE", unapproved.Code);
        Assert.Empty(await commerce.MonoSellerBranchMappings.ToListAsync());
        Assert.Equal(0, client.ListCalls);
    }

    private static AccountRecord Account(Guid id, DateTimeOffset now) => new()
    {
        Id = id,
        NormalizedPhone = "09" + RandomNumberGenerator.GetInt32(0, 1_000_000_000).ToString("D9"),
        CreatedAtUtc = now
    };

    private static SellerRegistrationDraft Draft(Guid id, DateTimeOffset now) => new()
    {
        AccountId = id, StoreName = "CI", OwnerName = "CI", Phone = "09120000000",
        City = "CI", Address = "CI", PostalCode = "1234567890", UpdatedAtUtc = now
    };

    private static HanaCommerceDbContext CommerceContext(string connection) => new(
        new DbContextOptionsBuilder<HanaCommerceDbContext>()
            .UseNpgsql(connection, postgres => postgres.MigrationsHistoryTable("__EFMigrationsHistory", "commerce"))
            .Options);

    private static HanaSellerDbContext SellerContext(string connection) => new(
        new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, postgres => postgres.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options);

    private static HanaIdentityDbContext IdentityContext(string connection) => new(
        new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options);

    private sealed class StubMonoClient(MonoBranchList branches) : IMonoLogisticsClient
    {
        public bool IsAvailable => true;
        public int ListCalls { get; private set; }
        public Task<MonoBranchList> ListBranchesAsync(CancellationToken cancellationToken)
        {
            ListCalls++;
            return Task.FromResult(branches);
        }
        public Task<MonoDeliveryRequestCreated> CreateDeliveryRequestAsync(MonoDeliveryRequestInput request,
            string idempotencyKey, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<MonoDeliveryRequestDetail> GetDeliveryRequestAsync(string deliveryRequestId,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }

    private sealed class TestClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }
}
