using System.Text.Json;
using Npgsql;
using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hana.Api;

internal static class AllocationLearningProposalEndpoints
{
    internal static void MapAllocationLearningProposals(this WebApplication app, bool configured)
    {
        var routes = app.MapGroup("/api/v1/admin/allocation-proposals").WithTags("Admin");
        routes.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store";
            if (!http.Request.IsHttps && !app.Environment.IsDevelopment())
                return Results.StatusCode(503);
            var header = http.Request.Headers.Authorization.ToString();
            if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ||
                !SessionTokenCodec.TryComputeDigest(header[7..], out _)) return Results.Unauthorized();
            if (!configured) return Results.StatusCode(503);
            try
            {
                var services = http.RequestServices;
                var account = await services.GetRequiredService<AuthSessionService>()
                    .ResolveAccountAsync(header[7..], http.RequestAborted);
                if (account is null) return Results.Unauthorized();
                if (!await services.GetRequiredService<RoleAuthorizationService>()
                    .HasRoleAsync(account.Value, HanaRoles.Admin, http.RequestAborted))
                    return Results.StatusCode(403);
                http.Items["AllocationReviewerAccount"] = account.Value;
                return await next(context);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" }) { return Results.Conflict(); }
            catch (UnauthorizedAccessException) { return Results.StatusCode(403); }
            catch (AllocationProposalConflictException) { return Results.Conflict(); }
            catch (ArgumentException) { return Results.BadRequest(new { error = "INVALID_ALLOCATION_PROPOSAL" }); }
            catch (Exception) when (!http.RequestAborted.IsCancellationRequested) { return Results.StatusCode(503); }
        });

        routes.MapPost("/research/assessments", async (CaptureAssessmentRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            if (input.Scores is null || string.IsNullOrWhiteSpace(input.EvidenceReference) ||
                input.GeographicFactor is null || input.AllocatedRial is null || input.AssessedAtUtc is null ||
                input.Scores.Health is null || input.Scores.Hardship is null || input.Scores.Age is null ||
                input.Scores.Size is null || input.Scores.Care is null || input.Scores.Education is null)
                return Results.BadRequest();
            var s = input.Scores;
            var scores = new HouseholdNeedScores(s.Health.Value, s.Hardship.Value, s.Age.Value,
                s.Size.Value, s.Care.Value, s.Education.Value);
            // The documented baseline is fixed here. Input is an attributed external snapshot,
            // not a payment authorization or an automatically verified household profile.
            await services.GetRequiredService<AllocationLearningRecorder>().RecordAssessmentAsync(
                input.SnapshotId, new(input.HouseholdKey, scores, input.GeographicFactor.Value),
                AllocationWeightProfile.Baseline.Version, input.DatasetVersion, input.SourceInstructionReference,
                input.AllocatedRial.Value, input.AssessedAtUtc.Value, ct,
                (Guid)http.Items["AllocationReviewerAccount"]!, input.EvidenceReference);
            return Results.Created("/api/v1/admin/allocation-proposals/research/assessments",
                new { id = input.SnapshotId, active = false });
        });

        routes.MapGet("/research/assessments", async (int? page, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var rows = await db.Assessments.AsNoTracking()
                .OrderByDescending(x => x.AssessedAtUtc)
                .ThenBy(x => x.Id).Skip((p - 1) * 20).Take(20)
                .ToListAsync(ct);
            var items = rows.Select(x => new {
                x.Id, x.DatasetVersion, x.SourceInstructionReference, x.FormulaVersion,
                x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education, x.AssessedAtUtc,
                x.EvidenceReference,
                trainingEligible =
                    AllocationTrainingWorkflow.IsTrainingEligibleFirstPartySnapshot(x)
            }).ToList();
            return Results.Ok(new { items, page = p, active = false });
        });
        routes.MapGet("/research/labels", async (string rubricVersion, IServiceProvider services, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(rubricVersion) || rubricVersion.Length > 120) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var items = await db.NeedLabels.AsNoTracking().Where(x => x.RubricVersion == rubricVersion)
                .OrderByDescending(x => x.ReviewedAtUtc).ThenBy(x => x.Id).Take(501)
                .Select(x => new { x.Id, x.SnapshotId, x.NeedScore, x.Partition, x.ReviewedAtUtc }).ToListAsync(ct);
            return Results.Ok(new { items = items.Take(500), truncated = items.Count > 500, active = false });
        });
        routes.MapPost("/research/labels", async (NeedLabelRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var id = await services.GetRequiredService<AllocationTrainingWorkflow>().ReviewNeedAsync(
                (Guid)http.Items["AllocationReviewerAccount"]!, input.SnapshotId, input.NeedScore,
                input.RubricVersion, (LearningPartition)input.Partition, ct);
            return Results.Ok(new { id, active = false });
        });
        routes.MapGet("/research/runs", async (int? page, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var items = await db.TrainingRuns.AsNoTracking().OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id).Skip((p - 1) * 20).Take(20).Select(x => new {
                    x.Id, x.Status, x.DatasetVersion, x.ModelVersion, x.ProposalId, x.RecordedAtUtc
                }).ToListAsync(ct);
            return Results.Ok(new { items, page = p, active = false });
        });
        routes.MapGet("/research/runs/{id:guid}", async (Guid id, IServiceProvider services, CancellationToken ct) =>
        {
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var run = await db.TrainingRuns.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (run is null) return Results.NotFound();
            using var inputs = JsonDocument.Parse(run.InputsJson);
            using var metrics = run.MetricsJson is { } json ? JsonDocument.Parse(json) : null;
            var examples = inputs.RootElement.GetProperty("examples").EnumerateArray().ToArray();
            return Results.Ok(new { run.Id, run.Status, run.DatasetVersion, run.ModelVersion, run.ProposalId,
                run.RecordedAtUtc, run.CutoffUtc,
                poolRial = inputs.RootElement.GetProperty("poolRial").GetInt64(),
                sourceInstructionReference = inputs.RootElement.GetProperty("sourceInstructionReference").GetString(),
                rubricVersion = examples[0].GetProperty("RubricVersion").GetString(),
                trainingCount = examples.Count(x => x.GetProperty("Partition").GetInt32() == 1),
                validationCount = examples.Count(x => x.GetProperty("Partition").GetInt32() == 2),
                learningMetrics = metrics?.RootElement.Clone(), active = false });
        });

        routes.MapPost("/research/train", async (TrainAllocationRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            if (input.LabelIds is null) return Results.BadRequest();
            var run = await services.GetRequiredService<AllocationTrainingWorkflow>().TrainAsync(
                (Guid)http.Items["AllocationReviewerAccount"]!, input.LabelIds, input.PoolRial,
                input.CutoffUtc, ct);
            return Results.Ok(new { run.Id, run.Status, run.ProposalId, run.RecordedAtUtc, active = false });
        });

        routes.MapPost("", async (SubmitProposalRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            if (input.Weights is null || input.SnapshotIds is null) return Results.BadRequest();
            var w = input.Weights;
            var candidate = new AllocationWeightProfile(input.CandidateVersion, w.Health, w.Hardship,
                w.Age, w.Size, w.Care, w.Education);
            var id = await services.GetRequiredService<AllocationProposalService>().SubmitAsync(
                (Guid)http.Items["AllocationReviewerAccount"]!, candidate, input.ModelVersion,
                input.Rationale, input.SnapshotIds, input.PoolRial, input.DatasetVersion,
                input.SourceInstructionReference, ct);
            return Results.Created($"/api/v1/admin/allocation-proposals/{id}",
                new { id, status = "PENDING_REVIEW", active = false });
        });

        routes.MapGet("", async (int? page, int? pageSize, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            var size = pageSize ?? 20;
            if (p is < 1 or > 10000 || size is < 1 or > 50) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var rows = await db.Proposals.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc)
                .ThenBy(x => x.Id).Skip((p - 1) * size).Take(size).Select(x => new {
                    x.Id, x.CandidateVersion, x.BaselineVersion, x.ModelVersion, x.CreatedAtUtc,
                    decision = db.Reviews.Where(r => r.ProposalId == x.Id).Select(r => r.Decision).FirstOrDefault()
                }).ToListAsync(ct);
            return Results.Ok(new { items = rows, page = p, pageSize = size, active = false });
        });

        routes.MapGet("/{id:guid}", async (Guid id, IServiceProvider services, CancellationToken ct) =>
        {
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var proposal = await db.Proposals.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (proposal is null) return Results.NotFound();
            var review = await db.Reviews.AsNoTracking().SingleOrDefaultAsync(x => x.ProposalId == id, ct);
            var training = await db.TrainingRuns.AsNoTracking().SingleOrDefaultAsync(x => x.ProposalId == id, ct);
            using var metrics = training?.MetricsJson is { } json ? JsonDocument.Parse(json) : null;
            using var weights = JsonDocument.Parse(proposal.WeightsJson);
            using var report = JsonDocument.Parse(proposal.SimulationJson);
            using var snapshots = JsonDocument.Parse(proposal.SnapshotIdsJson);
            return Results.Ok(new {
                proposal.Id, proposal.CandidateVersion, proposal.ModelVersion, proposal.Rationale,
                proposal.BaselineVersion, proposal.DatasetVersion, proposal.SourceInstructionReference,
                proposal.PoolRial, proposal.CreatedByAccountId, proposal.CreatedAtUtc,
                weights = weights.RootElement.Clone(), simulation = report.RootElement.Clone(),
                snapshotIds = snapshots.RootElement.Clone(), review,
                trainingRunId = training?.Id, learningMetrics = metrics?.RootElement.Clone(),
                status = review?.Decision ?? "PENDING_REVIEW", active = false });
        });

        routes.MapPost("/{id:guid}/review", async (Guid id, ReviewProposalRequest input,
            HttpContext http, IServiceProvider services, CancellationToken ct) =>
        {
            var found = await services.GetRequiredService<AllocationProposalService>().ReviewAsync(id,
                (Guid)http.Items["AllocationReviewerAccount"]!, input.Decision, input.Reason, ct);
            if (!found) return Results.NotFound();
            return Results.Ok(new { id, status = input.Decision, active = false });
        });
    }
}

internal sealed record ProposalWeights(decimal Health, decimal Hardship, decimal Age,
    decimal Size, decimal Care, decimal Education);
internal sealed record SubmitProposalRequest(string CandidateVersion, string ModelVersion, string Rationale,
    ProposalWeights? Weights, Guid[]? SnapshotIds, long PoolRial, string DatasetVersion,
    string SourceInstructionReference);
internal sealed record ReviewProposalRequest(string Decision, string Reason);

internal sealed record NeedLabelRequest(Guid SnapshotId, decimal NeedScore, string RubricVersion, int Partition);
internal sealed record TrainAllocationRequest(Guid[]? LabelIds, long PoolRial, DateTimeOffset CutoffUtc);

internal sealed record AssessmentScores(int? Health, int? Hardship, int? Age, int? Size, int? Care, int? Education);
internal sealed record CaptureAssessmentRequest(Guid SnapshotId, Guid HouseholdKey, AssessmentScores? Scores,
    decimal? GeographicFactor, long? AllocatedRial, DateTimeOffset? AssessedAtUtc,
    string DatasetVersion, string SourceInstructionReference, string EvidenceReference);
