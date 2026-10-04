using System.Text.Json;
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
            catch (AllocationProposalConflictException) { return Results.Conflict(); }
            catch (ArgumentException) { return Results.BadRequest(new { error = "INVALID_ALLOCATION_PROPOSAL" }); }
            catch (Exception) when (!http.RequestAborted.IsCancellationRequested) { return Results.StatusCode(503); }
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
            using var weights = JsonDocument.Parse(proposal.WeightsJson);
            using var report = JsonDocument.Parse(proposal.SimulationJson);
            using var snapshots = JsonDocument.Parse(proposal.SnapshotIdsJson);
            return Results.Ok(new {
                proposal.Id, proposal.CandidateVersion, proposal.ModelVersion, proposal.Rationale,
                proposal.BaselineVersion, proposal.DatasetVersion, proposal.SourceInstructionReference,
                proposal.PoolRial, proposal.CreatedByAccountId, proposal.CreatedAtUtc,
                weights = weights.RootElement.Clone(), simulation = report.RootElement.Clone(),
                snapshotIds = snapshots.RootElement.Clone(), review,
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
