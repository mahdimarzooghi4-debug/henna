using System.Text.Json;
using Hana.Infrastructure.Commerce;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class SupporterCreditPurchaseReadServiceTests
{
    [Fact]
    public async Task ReadsPersistedOwnProgramGrantsAndCreditLinesInOneSnapshot()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var database = "supporter_read_" + Guid.NewGuid().ToString("N");
        await using (var admin = new NpgsqlConnection(connection))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand("CREATE DATABASE " + database, admin);
            await create.ExecuteNonQueryAsync();
        }
        connection = new NpgsqlConnectionStringBuilder(connection) { Database = database }.ConnectionString;
        await using var db = new HanaCommerceDbContext(
            new DbContextOptionsBuilder<HanaCommerceDbContext>().UseNpgsql(connection).Options);
        await db.Database.MigrateAsync();

        var programId = Guid.NewGuid();
        var otherProgramId = Guid.NewGuid();
        var account = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var category = Guid.NewGuid();
        var program = new CreditProgram(programId, "Own", "test-only",
            6000, 4000, now.AddDays(7), new List<Guid> { category });
        var otherProgram = new CreditProgram(otherProgramId, "Foreign", "test-only",
            9000, 8000, now.AddDays(7), new List<Guid> { category });
        var grant = new CreditGrant(Guid.NewGuid(), account, programId, 2000,
            1200, now.AddDays(7), new List<Guid> { category });
        var other = new CreditGrant(Guid.NewGuid(), stranger, otherProgramId, 1000,
            1000, now.AddDays(7), new List<Guid> { category });
        var item = new OrderItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            3, 1001, 2002, 1001, 1, "Rice");
        var paid = Purchase(grant, account, now, "PAID", "PARTIAL", item);
        var cashOnly = Purchase(grant, account, now.AddMinutes(1), "PAID", "NONE",
            new OrderItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                1, 600, 600, 0, 0, "Personal cash"));
        var foreign = Purchase(other, stranger, now, "PAID", "NONE",
            new OrderItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                1, 300, 0, 300, 0, "Foreign purchase"));

        void Add(Guid id, Guid owner, string kind, object body) =>
            db.Documents.Add(new CommerceDocument {
                Id = id, OwnerId = owner, Kind = kind,
                Body = JsonSerializer.Serialize(body), Revision = 1
            });
        Add(programId, Guid.NewGuid(), "PROGRAM", program);
        Add(otherProgramId, Guid.NewGuid(), "PROGRAM", otherProgram);
        Add(grant.Id, account, "CREDIT", grant);
        Add(other.Id, stranger, "CREDIT", other);
        Add(paid.Id, account, "ORDER", paid);
        Add(cashOnly.Id, account, "ORDER", cashOnly);
        Add(foreign.Id, stranger, "ORDER", foreign);
        await db.SaveChangesAsync();

        var reader = new SupporterCreditPurchaseReadService(db);
        var beneficiary = Assert.Single(await reader.ReadInternalAsync(programId));
        Assert.Equal(grant.Id, beneficiary.GrantId);
        Assert.Equal(account, beneficiary.AccountId);
        Assert.Equal(2000, beneficiary.GrantedRial);
        var purchased = Assert.Single(beneficiary.Purchases);
        Assert.Equal("Rice", purchased.RecordedProductName);
        Assert.Equal(1001, purchased.OriginalCreditRial);
        Assert.Equal(333, purchased.RefundedCreditRial);
        Assert.Equal(668, purchased.NetCreditRial);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reader.ReadInternalAsync(Guid.NewGuid()));

        // Corruption of document ownership is not silently treated as consent.
        var orderRow = await db.Documents.SingleAsync(d => d.Id == paid.Id);
        orderRow.OwnerId = stranger;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => reader.ReadInternalAsync(programId));
    }

    private static Order Purchase(CreditGrant grant, Guid buyer,
        DateTimeOffset time, string state, string refundState,
        params OrderItem[] items)
    {
        var credit = items.Sum(i => i.CreditRial);
        var cash = items.Sum(i => i.CashRial);
        return new Order(Guid.NewGuid(), buyer, Guid.NewGuid(), "PERSONAL",
            "PICKUP", new BuyerAddress(Guid.NewGuid(), buyer, Guid.NewGuid(),
                "Persisted test address", 0m, 0m),
            items.ToList(), cash + credit, cash, credit, grant.Id,
            state, refundState, 1, time, null, null);
    }
}
