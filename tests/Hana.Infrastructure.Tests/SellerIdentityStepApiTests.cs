using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hana.Infrastructure.Tests;

public sealed class SellerIdentityStepApiTests
{
    [Fact]
    public async Task NaturalVerificationFailsClosedAndLegalDataIsOnlyRecorded()
    {
        var connection = Environment.GetEnvironmentVariable(
            "ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var identityOptions = new DbContextOptionsBuilder<HanaIdentityDbContext>()
            .UseNpgsql(connection).Options;
        var sellerOptions = new DbContextOptionsBuilder<HanaSellerDbContext>()
            .UseNpgsql(connection, pg =>
                pg.MigrationsHistoryTable("__EFMigrationsHistory", "seller"))
            .Options;

        await using var identity = new HanaIdentityDbContext(identityOptions);
        await using var seller = new HanaSellerDbContext(sellerOptions);
        Assert.Empty(await identity.Database.GetPendingMigrationsAsync());
        Assert.Empty(await seller.Database.GetPendingMigrationsAsync());

        var now = DateTimeOffset.UtcNow;
        var naturalId = Guid.NewGuid();
        var legalId = Guid.NewGuid();
        var naturalPhone = NewPhone();
        var legalPhone = NewPhone();
        var naturalToken = SessionTokenCodec.Generate();
        var legalToken = SessionTokenCodec.Generate();
        Assert.True(SessionTokenCodec.TryComputeDigest(
            naturalToken, out var naturalHash));
        Assert.True(SessionTokenCodec.TryComputeDigest(
            legalToken, out var legalHash));

        identity.Accounts.AddRange(
            Account(naturalId, naturalPhone, now),
            Account(legalId, legalPhone, now));
        identity.AuthSessions.AddRange(
            Session(naturalId, naturalHash, now),
            Session(legalId, legalHash, now));
        await identity.SaveChangesAsync();

        seller.RegistrationDrafts.AddRange(
            Draft(naturalId, naturalPhone, "NATURAL", now),
            Draft(legalId, legalPhone, "LEGAL", now));
        await seller.SaveChangesAsync();

        using var defaultFactory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.UseEnvironment("Development"));
        using var naturalDefault = defaultFactory.CreateClient();
        naturalDefault.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", naturalToken);

        const string naturalUrl =
            "/api/v1/seller/registration/identity/natural";
        var unavailable = await naturalDefault.PostAsJsonAsync(
            naturalUrl,
            new { nationalCode = "0084575948", revision = 1 });
        Assert.Equal(HttpStatusCode.ServiceUnavailable,
            unavailable.StatusCode);

        var unchanged = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == naturalId);
        Assert.Equal(2, unchanged.CompletedStep);
        Assert.Null(unchanged.IdentityStatus);
        Assert.Null(unchanged.NaturalNationalCode);

        using var verifiedFactory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<ISellerNaturalIdentityVerifier>();
                    services.AddSingleton<ISellerNaturalIdentityVerifier>(
                        new CiVerifiedNaturalIdentityVerifier());
                });
            });
        using var natural = verifiedFactory.CreateClient();
        natural.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", naturalToken);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await natural.PostAsJsonAsync(naturalUrl,
                new { nationalCode = "0012345678", revision = 1 }))
            .StatusCode);

        var verified = await natural.PostAsJsonAsync(
            naturalUrl,
            new { nationalCode = "0084575948", revision = 1 });
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        using (var body = JsonDocument.Parse(
            await verified.Content.ReadAsStringAsync()))
        {
            Assert.Equal("VERIFIED",
                body.RootElement.GetProperty("identityStatus").GetString());
            Assert.Equal("******5948",
                body.RootElement.GetProperty("nationalCodeMasked").GetString());
            Assert.Equal(3,
                body.RootElement.GetProperty("completedStep").GetInt32());
            Assert.Equal(2,
                body.RootElement.GetProperty("revision").GetInt32());
        }

        var naturalRow = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == naturalId);
        Assert.Equal("VERIFIED", naturalRow.IdentityStatus);
        Assert.Equal("0084575948", naturalRow.NaturalNationalCode);
        Assert.Equal(3, naturalRow.CompletedStep);

        var naturalRead = await natural.GetAsync(
            "/api/v1/seller/registration");
        Assert.Equal(HttpStatusCode.OK, naturalRead.StatusCode);
        var naturalJson = await naturalRead.Content.ReadAsStringAsync();
        Assert.DoesNotContain("0084575948", naturalJson);
        Assert.Contains("******5948", naturalJson);

        using var legal = verifiedFactory.CreateClient();
        legal.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", legalToken);
        const string legalUrl =
            "/api/v1/seller/registration/identity/legal";

        Assert.Equal(HttpStatusCode.BadRequest,
            (await legal.PutAsJsonAsync(legalUrl, new
            {
                legalNationalId = "12345678901",
                legalName = "شرکت تست",
                representativeName = "نماینده تست",
                representativePhone = naturalPhone,
                revision = 1
            })).StatusCode);

        var legalSaved = await legal.PutAsJsonAsync(legalUrl, new
        {
            legalNationalId = "12345678901",
            legalName = "شرکت تست",
            representativeName = "نماینده تست",
            representativePhone = legalPhone,
            revision = 1
        });
        Assert.Equal(HttpStatusCode.OK, legalSaved.StatusCode);
        using (var body = JsonDocument.Parse(
            await legalSaved.Content.ReadAsStringAsync()))
        {
            Assert.Equal("RECORDED",
                body.RootElement.GetProperty("identityStatus").GetString());
            Assert.Equal(3,
                body.RootElement.GetProperty("completedStep").GetInt32());
        }

        var legalRow = await seller.RegistrationDrafts.AsNoTracking()
            .SingleAsync(x => x.AccountId == legalId);
        Assert.Equal("RECORDED", legalRow.IdentityStatus);
        Assert.Equal("12345678901", legalRow.LegalNationalId);
        Assert.Null(legalRow.NaturalNationalCode);
        Assert.Equal(3, legalRow.CompletedStep);

        Assert.Equal(HttpStatusCode.Conflict,
            (await legal.PostAsJsonAsync(naturalUrl,
                new { nationalCode = "0084575948", revision = 2 }))
            .StatusCode);
    }

    private static AccountRecord Account(
        Guid id, string phone, DateTimeOffset now) => new()
    {
        Id = id,
        NormalizedPhone = phone,
        CreatedAtUtc = now,
        PhoneVerifiedAtUtc = now
    };

    private static AuthSessionRecord Session(
        Guid accountId, byte[] digest, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        TokenDigest = digest,
        IssuedAtUtc = now.AddMinutes(-1),
        ExpiresAtUtc = now.AddHours(1)
    };

    private static SellerRegistrationDraft Draft(
        Guid accountId, string phone, string applicantType,
        DateTimeOffset now) => new()
    {
        AccountId = accountId,
        StoreName = "فروشگاه تست",
        OwnerName = "مسئول تست",
        Phone = phone,
        City = "تهران",
        Address = "نشانی تست",
        PostalCode = "1234567890",
        ApplicantType = applicantType,
        CompletedStep = 2,
        Status = "DRAFT",
        Revision = 1,
        UpdatedAtUtc = now
    };

    private static string NewPhone() =>
        "09" + RandomNumberGenerator.GetInt32(1_000_000_000)
            .ToString("D9", CultureInfo.InvariantCulture);

    private sealed class CiVerifiedNaturalIdentityVerifier
        : ISellerNaturalIdentityVerifier
    {
        public bool IsAvailable => true;

        public Task<SellerIdentityVerificationResult> VerifyAsync(
            string nationalCode,
            string verifiedPhone,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(
                nationalCode == "0084575948" &&
                verifiedPhone.StartsWith("09", StringComparison.Ordinal)
                    ? SellerIdentityVerificationResult.Verified
                    : SellerIdentityVerificationResult.NotMatched);
    }
}
