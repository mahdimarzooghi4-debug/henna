using System.Globalization;
using System.Security.Cryptography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class SellerRegistrationDraftTests
{
    [Fact]
    public async Task SellerSchemaIsMigratedAndDraftIsScopedToVerifiedAccount()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, x =>
                x.MigrationsHistoryTable("__EFMigrationsHistory", "seller")).Options;

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var accountId = Guid.NewGuid();
        var phone = "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);
        var now = new DateTimeOffset(2026, 9, 20, 16, 0, 0, TimeSpan.Zero);
        identity.Accounts.Add(new AccountRecord
        {
            Id = accountId,
            NormalizedPhone = phone,
            CreatedAtUtc = now,
            PhoneVerifiedAtUtc = now
        });
        await identity.SaveChangesAsync();

        seller.RegistrationDrafts.Add(new SellerRegistrationDraft
        {
            AccountId = accountId,
            StoreName = "فروشگاه اول",
            OwnerName = "مالک",
            Phone = phone,
            City = "تهران",
            Address = "نشانی",
            PostalCode = "1234567890",
            Status = "DRAFT",
            UpdatedAtUtc = now
        });
        await seller.SaveChangesAsync();
        Assert.Equal(1, await seller.RegistrationDrafts.CountAsync(
            x => x.AccountId == accountId));

        // Repeated save for the same account replaces one draft, never
        // creates a second seller or activates the store.
        var count = await seller.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO seller.registration_drafts
              (account_id, store_name, owner_name, phone, city,
               address, postal_code, status, updated_at_utc)
            VALUES ({accountId}, {"فروشگاه دوم"}, {"مالک"}, {phone},
              {"تهران"}, {"نشانی دوم"}, {"1234567890"}, 'DRAFT', {now})
            ON CONFLICT (account_id) DO UPDATE SET
              store_name = EXCLUDED.store_name,
              owner_name = EXCLUDED.owner_name,
              phone = EXCLUDED.phone,
              city = EXCLUDED.city,
              address = EXCLUDED.address,
              postal_code = EXCLUDED.postal_code,
              updated_at_utc = EXCLUDED.updated_at_utc
            WHERE registration_drafts.status = 'DRAFT'
            """);
        Assert.Equal(1, count);
        var stored = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == accountId);
        Assert.Equal("فروشگاه دوم", stored.StoreName);
        Assert.Equal("DRAFT", stored.Status);
        Assert.Equal(1, await seller.RegistrationDrafts.CountAsync(
            x => x.AccountId == accountId));

        var foreignKeys = await seller.Database.SqlQueryRaw<int>(
            """
            SELECT count(*)::integer AS "Value"
            FROM pg_constraint
            WHERE conname = 'fk_registration_drafts_accounts'
              AND conrelid = 'seller.registration_drafts'::regclass
            """).SingleAsync();
        Assert.Equal(1, foreignKeys);
    }
}
