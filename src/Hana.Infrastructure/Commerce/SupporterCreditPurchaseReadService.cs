using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Commerce;

/// <summary>
/// Internal persistence reader for one already-authorized program.
/// This class does NOT authenticate a supporter or authorize a program.
/// Never wire it to HTTP, BFF, UI or caller-supplied program identifiers
/// before a separate server-owned supporter-to-program disclosure grant exists.
/// </summary>
public sealed class SupporterCreditPurchaseReadService(HanaCommerceDbContext db)
{
    public async Task<IReadOnlyList<SupporterCreditPurchaseProjection.Beneficiary>>
        ReadInternalAsync(Guid programId, CancellationToken ct = default)
    {
        if (programId == Guid.Empty)
            throw new ArgumentException("An authorized program ID is required.", nameof(programId));

        // All reads see one PostgreSQL snapshot; a concurrent checkout, cancellation
        // or refund must not mix successive versions of grants and orders.
        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);

        var programRow = await db.Documents.AsNoTracking()
            .SingleOrDefaultAsync(d => d.Id == programId && d.Kind == "PROGRAM", ct)
            ?? throw new InvalidOperationException("Credit program not found.");
        var program = JsonSerializer.Deserialize<CreditProgram>(programRow.Body)
            ?? throw new InvalidOperationException("Credit program is corrupt.");
        if (program.Id != programId)
            throw new InvalidOperationException("Credit program identity mismatch.");

        // The PostgreSQL jsonb predicate scopes the grant rows in the database,
        // not after an unrestricted load into the application process.
        var predicate = JsonSerializer.Serialize(new { ProgramId = programId });
        var grantRows = await db.Documents.AsNoTracking()
            .Where(d => d.Kind == "CREDIT" && EF.Functions.JsonContains(d.Body, predicate))
            .ToListAsync(ct);
        var grants = grantRows.Select(row =>
        {
            var grant = JsonSerializer.Deserialize<CreditGrant>(row.Body)
                ?? throw new InvalidOperationException("Credit grant is corrupt.");
            if (grant.Id != row.Id || grant.AccountId != row.OwnerId ||
                grant.ProgramId != programId)
                throw new InvalidOperationException("Credit grant persistence mismatch.");
            return grant;
        }).ToArray();

        if (grants.Length == 0)
        {
            await transaction.CommitAsync(ct);
            return Array.Empty<SupporterCreditPurchaseProjection.Beneficiary>();
        }

        // A parameterized PostgreSQL uuid[] join prevents fetching unrelated
        // purchases from other accounts or programs. It has no HTTP consumer.
        var grantIds = grants.Select(g => g.Id).ToArray();
        var orderRows = await db.Documents.FromSqlInterpolated(
            $@"SELECT d.""Id"", d.""OwnerId"", d.""Kind"", d.""Body"", d.""Revision""
                FROM commerce.documents AS d
                WHERE d.""Kind"" = 'ORDER'
                  AND (d.""Body"" ->> 'CreditGrantId')::uuid = ANY ({grantIds})")
            .AsNoTracking().ToListAsync(ct);
        var orders = orderRows.Select(row =>
        {
            var order = JsonSerializer.Deserialize<Order>(row.Body)
                ?? throw new InvalidOperationException("Order is corrupt.");
            if (order.Id != row.Id || order.BuyerId != row.OwnerId)
                throw new InvalidOperationException("Order persistence identity mismatch.");
            return order;
        }).ToArray();

        var projection = SupporterCreditPurchaseProjection.Compose(
            programId, grants, orders);
        await transaction.CommitAsync(ct);
        return projection;
    }
}
