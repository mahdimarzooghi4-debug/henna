using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationProposalApiTests
{
    [Fact]
    public async Task AdminReviewIsAuditedAndDoesNotActivateAllocation()
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (string.IsNullOrWhiteSpace(connection)) return;
        await using var identity = new HanaIdentityDbContext(
            new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options);
        await using var learning = new HanaAllocationLearningDbContext(
            new DbContextOptionsBuilder<HanaAllocationLearningDbContext>().UseNpgsql(connection,
                pg => pg.MigrationsHistoryTable("__EFMigrationsHistory", "allocation_learning")).Options);
        Assert.Empty(await learning.Database.GetPendingMigrationsAsync());
        var now = DateTimeOffset.UtcNow;
        var creator = Guid.NewGuid(); var reviewer = Guid.NewGuid(); var ordinary = Guid.NewGuid();
        var tokens = new Dictionary<Guid, string>();
        foreach (var id in new[] { creator, reviewer, ordinary })
        {
            var token = SessionTokenCodec.Generate();
            Assert.True(SessionTokenCodec.TryComputeDigest(token, out var digest));
            tokens[id] = token;
            identity.Accounts.Add(new() { Id = id,
                NormalizedPhone = "09" + RandomNumberGenerator.GetInt32(1_000_000_000).ToString("D9", CultureInfo.InvariantCulture),
                CreatedAtUtc = now, PhoneVerifiedAtUtc = now });
            identity.AuthSessions.Add(new() { Id = Guid.NewGuid(), AccountId = id, TokenDigest = digest,
                IssuedAtUtc = now.AddMinutes(-1), ExpiresAtUtc = now.AddHours(1) });
            if (id != ordinary) identity.RoleAssignments.Add(new() {
                AccountId = id, Role = HanaRoles.Admin, GrantedAtUtc = now });
        }
        await identity.SaveChangesAsync();
        var dataset = "dataset-" + Guid.NewGuid();
        var source = "source-" + Guid.NewGuid();
        var snapshots = new[] { Guid.NewGuid(), Guid.NewGuid() };
        foreach (var id in snapshots)
            learning.Assessments.Add(new() { Id = id, HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                DatasetVersion = dataset, SourceInstructionReference = source,
                GeographicFactor = 1m, Health = id == snapshots[0] ? 3 : 0,
                Hardship = id == snapshots[1] ? 3 : 0, AllocatedRial = 500,
                AssessedAtUtc = now.AddDays(-1), RecordedAtUtc = now });
        await learning.SaveChangesAsync();
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["ConnectionStrings:AllocationLearningDb"] = connection }));
        });
        using var anonymous = factory.CreateClient();
        using var creatorClient = factory.CreateClient();
        using var reviewerClient = factory.CreateClient();
        using var ordinaryClient = factory.CreateClient();
        creatorClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens[creator]);
        reviewerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens[reviewer]);
        ordinaryClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens[ordinary]);
        const string url = "/api/v1/admin/allocation-proposals";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.GetAsync(url)).StatusCode);
        var version = "candidate-" + Guid.NewGuid();
        object Payload(string v, string d) => new {
            candidateVersion = v, modelVersion = "manual-research-v1", rationale = "CI offline comparison",
            weights = new { health = .25m, hardship = .30m, age = .18m, size = .12m, care = .10m, education = .05m },
            snapshotIds = snapshots, poolRial = 1000L, datasetVersion = d, sourceInstructionReference = source };
        Assert.Equal(HttpStatusCode.BadRequest,
            (await creatorClient.PostAsJsonAsync(url, Payload(version, "wrong-dataset"))).StatusCode);
        var submitted = await creatorClient.PostAsJsonAsync(url, Payload(version, dataset));
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        using var submitJson = JsonDocument.Parse(await submitted.Content.ReadAsStringAsync());
        var proposalId = submitJson.RootElement.GetProperty("id").GetGuid();
        Assert.False(submitJson.RootElement.GetProperty("active").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict,
            (await creatorClient.PostAsJsonAsync(url, Payload(version, dataset))).StatusCode);
        var reviewUrl = $"{url}/{proposalId}/review";
        var decision = new { decision = "APPROVED", reason = "Reviewed offline simulation only" };
        Assert.Equal(HttpStatusCode.Conflict, (await creatorClient.PostAsJsonAsync(reviewUrl, decision)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.PostAsJsonAsync(reviewUrl, decision)).StatusCode);
        var concurrent = await Task.WhenAll(reviewerClient.PostAsJsonAsync(reviewUrl, decision),
            reviewerClient.PostAsJsonAsync(reviewUrl, new { decision = "REJECTED", reason = "Concurrent decision" }));
        Assert.Single(concurrent.Where(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Single(concurrent.Where(r => r.StatusCode == HttpStatusCode.Conflict));
        var detail = await reviewerClient.GetAsync($"{url}/{proposalId}");
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        Assert.Contains("no-store", detail.Headers.CacheControl!.ToString());
        using var body = JsonDocument.Parse(await detail.Content.ReadAsStringAsync());
        Assert.False(body.RootElement.GetProperty("active").GetBoolean());
        Assert.Equal(2, body.RootElement.GetProperty("simulation").GetProperty("Rows").GetArrayLength());
        var audit = Assert.Single(await learning.Reviews.AsNoTracking().Where(x => x.ProposalId == proposalId).ToListAsync());
        Assert.Equal(reviewer, audit.ReviewerAccountId);
        Assert.Contains(audit.Decision, new[] { "APPROVED", "REJECTED" });
        // Revocation takes effect on the next privileged request.
        identity.RoleAssignments.Remove(await identity.RoleAssignments.SingleAsync(x => x.AccountId == reviewer));
        await identity.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await reviewerClient.GetAsync($"{url}/{proposalId}")).StatusCode);
    }
}
