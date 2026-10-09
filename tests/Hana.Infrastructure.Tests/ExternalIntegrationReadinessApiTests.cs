using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Hana.Infrastructure.Tests;

public sealed class ExternalIntegrationReadinessApiTests
{
    [Fact]
    public async Task ShippingDefaultsExposeIbanOwnershipAsIndependentFailClosedDependency()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var options = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        await using var db = new HanaIdentityDbContext(options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var adminId = Guid.NewGuid();
        var token = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(token, out var digest));

        db.Accounts.Add(new AccountRecord
        {
            Id = adminId,
            NormalizedPhone = "09" +
                RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9"),
            CreatedAtUtc = now,
            PhoneVerifiedAtUtc = now
        });
        db.RoleAssignments.Add(new RoleAssignmentRecord
        {
            AccountId = adminId,
            Role = HanaRoles.Admin,
            GrantedAtUtc = now
        });
        db.AuthSessions.Add(new AuthSessionRecord
        {
            Id = Guid.NewGuid(),
            AccountId = adminId,
            TokenDigest = digest,
            IssuedAtUtc = now.AddMinutes(-1),
            ExpiresAtUtc = now.AddHours(1)
        });
        await db.SaveChangesAsync();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync(
            "/api/v1/admin/integrations/status");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var body = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        var root = body.RootElement;
        var iban = root.GetProperty("ibanOwnership");
        Assert.False(iban.GetProperty("configured").GetBoolean());
        Assert.True(iban.GetProperty(
            "requiredForWithdrawalOwnership").GetBoolean());
        Assert.False(root.GetProperty("allExternalReady").GetBoolean());

        Assert.False(root.TryGetProperty("providerUrl", out _));
        Assert.False(root.TryGetProperty("credential", out _));
    }
}
