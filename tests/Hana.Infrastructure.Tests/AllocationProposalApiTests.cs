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
        var dataset = HennaAllocationLearningCapture.DatasetVersion;
        var source = "henna-program:" + Guid.NewGuid();
        var snapshots = new[] { Guid.NewGuid(), Guid.NewGuid() };
        foreach (var id in snapshots)
            learning.Assessments.Add(new() { Id = id, HouseholdKey = Guid.NewGuid(),
                FormulaVersion = AllocationWeightProfile.Baseline.Version,
                DatasetVersion = dataset, SourceInstructionReference = source,
                GeographicFactor = 1m, Health = id == snapshots[0] ? 3 : 0,
                Hardship = id == snapshots[1] ? 3 : 0, AllocatedRial = 500,
                AssessedAtUtc = now.AddMinutes(-2), RecordedAtUtc = now });
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
        var research = url + "/research";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(research + "/assessments")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.GetAsync(research + "/assessments")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.GetAsync(research + "/assessments?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await creatorClient.GetAsync(research + "/assessments")).StatusCode);
        var runId = Guid.NewGuid();
        learning.TrainingRuns.Add(new() { Id = runId, RequestedByAccountId = creator,
            Status = "NO_IMPROVEMENT", DatasetVersion = dataset, ModelVersion = "audit-api-test",
            CutoffUtc = now.AddMinutes(-1), RecordedAtUtc = now,
            InputsJson = JsonSerializer.Serialize(new { poolRial = 1000L, sourceInstructionReference = source,
                examples = Enumerable.Range(0,40).Select(i => new { Partition = i < 30 ? 1 : 2, RubricVersion = "audit-rubric" }) }) });
        await learning.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(research + "/runs")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.GetAsync(research + $"/runs/{runId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await creatorClient.GetAsync(research + $"/runs/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.GetAsync(research + "/runs?page=0")).StatusCode);
        var runDetail = await creatorClient.GetAsync(research + $"/runs/{runId}");
        Assert.Equal(HttpStatusCode.OK, runDetail.StatusCode);
        Assert.Contains("no-store", runDetail.Headers.CacheControl!.ToString());
        using var runJson = JsonDocument.Parse(await runDetail.Content.ReadAsStringAsync());
        Assert.Equal(30, runJson.RootElement.GetProperty("trainingCount").GetInt32());
        Assert.Equal(10, runJson.RootElement.GetProperty("validationCount").GetInt32());
        Assert.Equal("NO_IMPROVEMENT", runJson.RootElement.GetProperty("status").GetString());
        Assert.False(runJson.RootElement.GetProperty("active").GetBoolean());
        Assert.False(runJson.RootElement.TryGetProperty("inputsJson", out _));
        var capturedId = Guid.NewGuid();
        var householdKey = Guid.NewGuid();
        object Capture(Guid snapshotId, DateTimeOffset assessed) => new {
            snapshotId, householdKey, datasetVersion = dataset, sourceInstructionReference = source,
            evidenceReference = "approved-record-" + capturedId,
            geographicFactor = 1.1m, allocatedRial = 700L, assessedAtUtc = assessed,
            scores = new { health = 1, hardship = 2, age = 0, size = 1, care = 0, education = 3 },
            recordedByAccountId = ordinary // Cannot override server identity.
        };
        var captureUrl = research + "/assessments";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync(captureUrl, Capture(capturedId, now.AddMinutes(-1)))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.PostAsJsonAsync(captureUrl, Capture(capturedId, now.AddMinutes(-1)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.PostAsJsonAsync(captureUrl, Capture(Guid.NewGuid(), now.AddDays(1)))).StatusCode);
        var captured = await creatorClient.PostAsJsonAsync(captureUrl, Capture(capturedId, now.AddMinutes(-1)));
        Assert.Equal(HttpStatusCode.Created, captured.StatusCode);
        var replayedCapture = await creatorClient.PostAsJsonAsync(
            captureUrl, Capture(capturedId, now.AddMinutes(-1)));
        Assert.Equal(HttpStatusCode.OK, replayedCapture.StatusCode);
        using (var replayJson = JsonDocument.Parse(
            await replayedCapture.Content.ReadAsStringAsync()))
            Assert.True(replayJson.RootElement.GetProperty("replayed").GetBoolean());

        var divergentCapture = new {
            snapshotId = capturedId,
            householdKey,
            datasetVersion = dataset,
            sourceInstructionReference = source,
            evidenceReference = "approved-record-" + capturedId,
            geographicFactor = 1.1m,
            allocatedRial = 701L,
            assessedAtUtc = now.AddMinutes(-1),
            scores = new {
                health = 1, hardship = 2, age = 0,
                size = 1, care = 0, education = 3
            }
        };
        Assert.Equal(HttpStatusCode.Conflict,
            (await creatorClient.PostAsJsonAsync(
                captureUrl, divergentCapture)).StatusCode);

        var storedAssessment = await learning.Assessments.AsNoTracking().SingleAsync(x => x.Id == capturedId);
        Assert.Equal(creator, storedAssessment.RecordedByAccountId);
        Assert.Equal(householdKey, storedAssessment.HouseholdKey);
        Assert.Equal("approved-record-" + capturedId, storedAssessment.EvidenceReference);
        Assert.Equal(AllocationWeightProfile.Baseline.Version, storedAssessment.FormulaVersion);
        Assert.Equal(700L, storedAssessment.AllocatedRial);
        using (var assessmentsJson = JsonDocument.Parse(
            await (await creatorClient.GetAsync(
                research + "/assessments")).Content.ReadAsStringAsync()))
        {
            var rows = assessmentsJson.RootElement.GetProperty("items")
                .EnumerateArray().ToArray();
            Assert.True(rows.Single(x => x.GetProperty("id").GetGuid() ==
                snapshots[0]).GetProperty("trainingEligible").GetBoolean());
            Assert.False(rows.Single(x => x.GetProperty("id").GetGuid() ==
                capturedId).GetProperty("trainingEligible").GetBoolean());
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.PostAsJsonAsync(captureUrl, new {
            snapshotId = Guid.NewGuid(), householdKey, datasetVersion = dataset, sourceInstructionReference = source,
            evidenceReference = "missing-scores", geographicFactor = 1m, allocatedRial = 0L,
            assessedAtUtc = now.AddDays(-1), scores = new { health = 0 }
        })).StatusCode);
        var rubric = "rubric-" + Guid.NewGuid();
        var label = new { snapshotId = snapshots[0], needScore = .8m, rubricVersion = rubric, partition = 1 };
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.PostAsJsonAsync(research + "/labels", label)).StatusCode);
        var labeled = await creatorClient.PostAsJsonAsync(research + "/labels", label);
        Assert.Equal(HttpStatusCode.OK, labeled.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await creatorClient.PostAsJsonAsync(research + "/labels", label)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.PostAsJsonAsync(research + "/labels",
            new { snapshotId = snapshots[1], needScore = 2m, rubricVersion = rubric, partition = 1 })).StatusCode);
        using var labelsJson = JsonDocument.Parse(await (await creatorClient.GetAsync(research + "/labels?rubricVersion=" + rubric)).Content.ReadAsStringAsync());
        Assert.Single(labelsJson.RootElement.GetProperty("items").EnumerateArray());
        Assert.False(labelsJson.RootElement.GetProperty("active").GetBoolean());
        var storedLabel = await learning.NeedLabels.AsNoTracking().SingleAsync(x => x.SnapshotId == snapshots[0] && x.RubricVersion == rubric);
        Assert.Equal(creator, storedLabel.ReviewerAccountId);

        var automationUrl = research + "/automation/readiness";
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync(automationUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ordinaryClient.GetAsync(automationUrl)).StatusCode);
        var automationReadiness = await creatorClient.GetAsync(automationUrl);
        Assert.Equal(HttpStatusCode.OK, automationReadiness.StatusCode);
        using (var automationJson = JsonDocument.Parse(
            await automationReadiness.Content.ReadAsStringAsync()))
        {
            Assert.Equal("TRIGGER_POLICY_REQUIRED",
                automationJson.RootElement.GetProperty("status").GetString());
            Assert.False(automationJson.RootElement
                .GetProperty("triggerPolicyConfigured").GetBoolean());
            Assert.False(automationJson.RootElement
                .GetProperty("automaticTrainingEnabled").GetBoolean());
            var missing = automationJson.RootElement
                .GetProperty("missingPolicyRequirements")
                .EnumerateArray()
                .Select(x => x.GetString())
                .ToArray();
            Assert.Contains("ENABLED", missing);
            Assert.Contains("AUTOMATION_ACCOUNT_ID", missing);
            Assert.Contains("POOL_RIAL", missing);
            Assert.Contains("POLL_INTERVAL_MINUTES", missing);
            var cohort = Assert.Single(automationJson.RootElement
                .GetProperty("cohorts")
                .EnumerateArray()
                .Where(x =>
                    x.GetProperty("datasetVersion").GetString() == dataset &&
                    x.GetProperty("sourceInstructionReference").GetString() == source &&
                    x.GetProperty("rubricVersion").GetString() == rubric)
                .ToArray());
            Assert.Equal(1,
                cohort.GetProperty("trainingLabelCount").GetInt32());
            Assert.Equal(0,
                cohort.GetProperty("validationLabelCount").GetInt32());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await creatorClient.PostAsJsonAsync(research + "/train",
            new { labelIds = new[] { storedLabel.Id }, poolRial = 1000, cutoffUtc = DateTimeOffset.UtcNow })).StatusCode);
        using (var malformedTrainingKey = new HttpRequestMessage(
            HttpMethod.Post, research + "/train")
        {
            Content = JsonContent.Create(new
            {
                labelIds = new[] { storedLabel.Id },
                poolRial = 1000,
                cutoffUtc = DateTimeOffset.UtcNow
            })
        })
        {
            malformedTrainingKey.Headers.Add("Idempotency-Key", "not-a-guid");
            Assert.Equal(HttpStatusCode.BadRequest,
                (await creatorClient.SendAsync(malformedTrainingKey)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinaryClient.PostAsJsonAsync(research + "/train",
            new { labelIds = new[] { storedLabel.Id }, poolRial = 1000, cutoffUtc = DateTimeOffset.UtcNow })).StatusCode);
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

        var pilotVersion = "pilot-candidate-" + Guid.NewGuid();
        var pilotSubmitted = await creatorClient.PostAsJsonAsync(
            url, Payload(pilotVersion, dataset));
        Assert.Equal(HttpStatusCode.Created, pilotSubmitted.StatusCode);
        using var pilotSubmittedJson = JsonDocument.Parse(
            await pilotSubmitted.Content.ReadAsStringAsync());
        var pilotProposalId = pilotSubmittedJson.RootElement
            .GetProperty("id").GetGuid();
        var pilotUrl = $"{url}/{pilotProposalId}/pilot";
        var pilotAuthorization = new
        {
            scopeReference = "pilot-scope-" + Guid.NewGuid(),
            reason = "Explicit controlled pilot authorization"
        };

        Assert.Equal(HttpStatusCode.Conflict,
            (await creatorClient.PostAsJsonAsync(
                pilotUrl + "/authorize", pilotAuthorization)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await reviewerClient.PostAsJsonAsync(
                $"{url}/{pilotProposalId}/review",
                new
                {
                    decision = "APPROVED",
                    reason = "Independent human review before pilot"
                })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ordinaryClient.PostAsJsonAsync(
                pilotUrl + "/authorize", pilotAuthorization)).StatusCode);

        var authorizedPilot = await creatorClient.PostAsJsonAsync(
            pilotUrl + "/authorize", pilotAuthorization);
        Assert.Equal(HttpStatusCode.OK, authorizedPilot.StatusCode);
        using (var authorizedJson = JsonDocument.Parse(
            await authorizedPilot.Content.ReadAsStringAsync()))
        {
            Assert.Equal("PILOT_AUTHORIZED",
                authorizedJson.RootElement.GetProperty("status").GetString());
            Assert.False(authorizedJson.RootElement
                .GetProperty("active").GetBoolean());
            Assert.False(authorizedJson.RootElement
                .GetProperty("runtimeApplied").GetBoolean());
        }
        Assert.Equal(HttpStatusCode.Conflict,
            (await creatorClient.PostAsJsonAsync(
                pilotUrl + "/authorize", pilotAuthorization)).StatusCode);

        var completedPilot = await reviewerClient.PostAsJsonAsync(
            pilotUrl + "/complete",
            new { reason = "Pilot evidence reviewed; close pilot only" });
        Assert.Equal(HttpStatusCode.OK, completedPilot.StatusCode);
        using (var completedJson = JsonDocument.Parse(
            await completedPilot.Content.ReadAsStringAsync()))
        {
            Assert.Equal("PILOT_COMPLETED",
                completedJson.RootElement.GetProperty("status").GetString());
            Assert.False(completedJson.RootElement
                .GetProperty("active").GetBoolean());
            Assert.False(completedJson.RootElement
                .GetProperty("runtimeApplied").GetBoolean());
        }
        Assert.Equal(HttpStatusCode.Conflict,
            (await creatorClient.PostAsJsonAsync(
                pilotUrl + "/abort",
                new { reason = "Cannot change a terminal pilot state" })).StatusCode);

        var pilotDetail = await creatorClient.GetAsync(pilotUrl);
        Assert.Equal(HttpStatusCode.OK, pilotDetail.StatusCode);
        using (var pilotJson = JsonDocument.Parse(
            await pilotDetail.Content.ReadAsStringAsync()))
        {
            Assert.Equal("PILOT_COMPLETED",
                pilotJson.RootElement.GetProperty("status").GetString());
            Assert.Equal(2, pilotJson.RootElement
                .GetProperty("events").GetArrayLength());
            Assert.False(pilotJson.RootElement
                .GetProperty("active").GetBoolean());
            Assert.False(pilotJson.RootElement
                .GetProperty("runtimeApplied").GetBoolean());
        }

        // Revocation takes effect on the next privileged request.
        identity.RoleAssignments.Remove(await identity.RoleAssignments.SingleAsync(x => x.AccountId == reviewer));
        await identity.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await reviewerClient.GetAsync($"{url}/{proposalId}")).StatusCode);
    }
}
