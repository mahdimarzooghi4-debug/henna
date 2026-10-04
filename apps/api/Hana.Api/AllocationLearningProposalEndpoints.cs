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

        routes.MapGet("/research/assessments", async (int? page, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var items = await db.Assessments.AsNoTracking().OrderByDescending(x => x.AssessedAtUtc)
                .ThenBy(x => x.Id).Skip((p - 1) * 20).Take(20).Select(x => new {
                    x.Id, x.DatasetVersion, x.SourceInstructionReference, x.FormulaVersion,
                    x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education, x.AssessedAtUtc
                }).ToListAsync(ct);
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
