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
            catch (AllocationTrainingIdempotencyConflictException) { return Results.Conflict(); }
            catch (AllocationAssessmentIdempotencyConflictException) { return Results.Conflict(); }
            catch (AllocationReviewedOutcomeConflictException) { return Results.Conflict(); }
            catch (AllocationPilotConflictException) { return Results.Conflict(); }
            catch (AllocationProductionControlConflictException) { return Results.Conflict(); }
            catch (AllocationRuntimePromotionConflictException) { return Results.Conflict(); }
            catch (AllocationRetentionConflictException) { return Results.Conflict(); }
            catch (AllocationModelBenchmarkConflictException) { return Results.Conflict(); }
            catch (AllocationShadowModelBenchmarkConflictException) { return Results.Conflict(); }
            catch (AllocationEbmArtifactConflictException) { return Results.Conflict(); }
            catch (AllocationEbmBenchmarkConflictException) { return Results.Conflict(); }
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
            var created = await services.GetRequiredService<AllocationLearningRecorder>()
                .RecordAssessmentIdempotentlyAsync(
                    input.SnapshotId, new(input.HouseholdKey, scores, input.GeographicFactor.Value),
                    AllocationWeightProfile.Baseline.Version, input.DatasetVersion, input.SourceInstructionReference,
                    input.AllocatedRial.Value, input.AssessedAtUtc.Value, ct,
                    (Guid)http.Items["AllocationReviewerAccount"]!, input.EvidenceReference);
            var payload = new { id = input.SnapshotId, active = false, replayed = !created };
            return created
                ? Results.Created("/api/v1/admin/allocation-proposals/research/assessments", payload)
                : Results.Ok(payload);
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
            var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
                db, rows, ct);
            var items = rows.Select(x => new {
                x.Id, x.DatasetVersion, x.SourceInstructionReference, x.FormulaVersion,
                x.RuntimeProposalId, x.RuntimeProfileSequence,
                x.Health, x.Hardship, x.Age, x.Size, x.Care, x.Education, x.AssessedAtUtc,
                x.EvidenceReference,
                trainingEligible = lineage.ContainsKey(x.Id)
            }).ToList();
            return Results.Ok(new { items, page = p, active = false });
        });
        routes.MapPost("/research/outcomes", async (
            CaptureReviewedOutcomeRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var created = await services.GetRequiredService<AllocationReviewedOutcomeService>()
                .RecordAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    new AllocationReviewedOutcomeInput(
                        input.EventId,
                        input.SnapshotId,
                        input.PeriodStartUtc,
                        input.PeriodEndUtc,
                        input.EssentialNeedsCoverage,
                        input.StockBarrier,
                        input.DeliveryBarrier,
                        input.AccessBarrier,
                        input.EvidenceReference),
                    ct);
            var payload = new
            {
                id = input.EventId,
                snapshotId = input.SnapshotId,
                evidence = "HUMAN_REVIEWED",
                active = false,
                replayed = !created
            };
            return created
                ? Results.Created(
                    "/api/v1/admin/allocation-proposals/research/outcomes",
                    payload)
                : Results.Ok(payload);
        });

        routes.MapGet("/research/outcomes", async (
            int? page, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var items = await db.Outcomes.AsNoTracking()
                .OrderByDescending(x => x.PeriodEndUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .Select(x => new
                {
                    x.Id,
                    x.SnapshotId,
                    x.PeriodStartUtc,
                    x.PeriodEndUtc,
                    x.CreditUsedRial,
                    x.EssentialNeedsCoverage,
                    x.StockBarrier,
                    x.DeliveryBarrier,
                    x.AccessBarrier,
                    evidence = x.Evidence,
                    x.ReviewedByAccountId,
                    x.EvidenceReference,
                    x.RecordedAtUtc
                })
                .ToListAsync(ct);
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
        routes.MapGet("/research/retention/preview", async (
            DateTimeOffset cutoffUtc, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var preview = await services.GetRequiredService<AllocationRetentionService>()
                .PreviewAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    cutoffUtc,
                    ct);
            return Results.Ok(new
            {
                preview.Scope,
                preview.CutoffUtc,
                preview.TotalEligibleSnapshotCount,
                preview.SelectedSnapshotCount,
                preview.SelectedOutcomeCount,
                preview.Truncated,
                preview.PreviewDigest,
                active = false
            });
        });

        routes.MapPost("/research/retention/purge", async (
            AllocationRetentionPurgeRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var keyHeader = http.Request.Headers["Idempotency-Key"].ToString();
            if (!Guid.TryParse(keyHeader, out var requestId) ||
                requestId == Guid.Empty)
                return Results.ValidationProblem(
                    new Dictionary<string, string[]>
                    {
                        ["idempotencyKey"] = ["کلید حذف retention معتبر نیست."]
                    });

            var result = await services.GetRequiredService<AllocationRetentionService>()
                .PurgeAsync(
                    requestId,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.CutoffUtc,
                    input.PreviewDigest,
                    input.Reason,
                    ct);
            return Results.Ok(new
            {
                result.EventId,
                result.DeletedSnapshotCount,
                result.DeletedOutcomeCount,
                result.PreviewDigest,
                active = false
            });
        });

        routes.MapGet("/research/retention/events", async (
            int? page, IServiceProvider services, CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var items = await db.RetentionEvents.AsNoTracking()
                .OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .Select(x => new
                {
                    x.Id,
                    x.ActorAccountId,
                    x.Scope,
                    x.CutoffUtc,
                    x.DeletedSnapshotCount,
                    x.DeletedOutcomeCount,
                    x.Reason,
                    x.RecordedAtUtc
                })
                .ToListAsync(ct);
            return Results.Ok(new { items, page = p, active = false });
        });

        routes.MapPost("/research/benchmarks", async (
            AllocationModelBenchmarkRequest input,
            HttpContext http,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            if (input.EvaluationLabelIds is null)
                return Results.BadRequest();
            var row = await services
                .GetRequiredService<AllocationModelBenchmarkService>()
                .EvaluateAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.ProposalId,
                    input.EvaluationLabelIds,
                    input.CutoffUtc,
                    ct);
            var metrics = JsonSerializer.Deserialize<AllocationModelBenchmarkMetrics>(
                row.MetricsJson)
                ?? throw new InvalidOperationException(
                    "Stored benchmark metrics are invalid.");
            return Results.Ok(new
            {
                row.Id,
                row.ProposalId,
                row.ProtocolVersion,
                row.ModelVersion,
                row.BaselineVersion,
                row.CandidateVersion,
                row.DatasetVersion,
                row.SourceInstructionReference,
                row.RuntimeProposalId,
                row.RuntimeProfileSequence,
                row.EvaluationFingerprint,
                metrics,
                row.CutoffUtc,
                row.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                active = false
            });
        });

        routes.MapGet("/research/benchmarks", async (
            string? evaluationFingerprint,
            int? page,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            if (evaluationFingerprint is not null &&
                (evaluationFingerprint.Length != 64 ||
                 evaluationFingerprint.Any(x => !Uri.IsHexDigit(x))))
                return Results.BadRequest();

            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var query = db.ModelBenchmarks.AsNoTracking().AsQueryable();
            if (evaluationFingerprint is not null)
                query = query.Where(x =>
                    x.EvaluationFingerprint == evaluationFingerprint.ToLower());

            var rows = await query
                .OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .ToListAsync(ct);
            var items = rows.Select(x => new
            {
                x.Id,
                x.ProposalId,
                x.ProtocolVersion,
                x.ModelVersion,
                x.BaselineVersion,
                x.CandidateVersion,
                x.DatasetVersion,
                x.SourceInstructionReference,
                x.RuntimeProposalId,
                x.RuntimeProfileSequence,
                x.EvaluationFingerprint,
                metrics = JsonSerializer.Deserialize<AllocationModelBenchmarkMetrics>(
                    x.MetricsJson),
                x.CutoffUtc,
                x.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                active = false
            }).ToList();
            return Results.Ok(new { items, page = p, active = false });
        });

        routes.MapPost("/research/shadow-benchmarks", async (
            AllocationShadowModelBenchmarkRequest input,
            HttpContext http,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            if (input.EvaluationLabelIds is null)
                return Results.BadRequest();
            var row = await services
                .GetRequiredService<AllocationShadowModelBenchmarkService>()
                .EvaluateAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.TrainingRunId,
                    input.EvaluationLabelIds,
                    input.CutoffUtc,
                    ct);
            var metrics =
                JsonSerializer.Deserialize<HennaXGBoostShadowBenchmarkMetrics>(
                    row.MetricsJson)
                ?? throw new InvalidOperationException(
                    "Stored shadow benchmark metrics are invalid.");
            return Results.Ok(new
            {
                row.Id,
                row.TrainingRunId,
                row.ProtocolVersion,
                row.ModelVersion,
                row.ArtifactSha256,
                row.BaselineVersion,
                row.DatasetVersion,
                row.SourceInstructionReference,
                row.RuntimeProposalId,
                row.RuntimeProfileSequence,
                row.EvaluationFingerprint,
                metrics,
                row.CutoffUtc,
                row.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapGet("/research/shadow-benchmarks", async (
            string? evaluationFingerprint,
            int? page,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            if (evaluationFingerprint is not null &&
                (evaluationFingerprint.Length != 64 ||
                 evaluationFingerprint.Any(x => !Uri.IsHexDigit(x))))
                return Results.BadRequest();

            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var query = db.ShadowModelBenchmarks.AsNoTracking().AsQueryable();
            if (evaluationFingerprint is not null)
                query = query.Where(x =>
                    x.EvaluationFingerprint == evaluationFingerprint.ToLower());

            var rows = await query
                .OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .ToListAsync(ct);
            var items = rows.Select(x => new
            {
                x.Id,
                x.TrainingRunId,
                x.ProtocolVersion,
                x.ModelVersion,
                x.ArtifactSha256,
                x.BaselineVersion,
                x.DatasetVersion,
                x.SourceInstructionReference,
                x.RuntimeProposalId,
                x.RuntimeProfileSequence,
                x.EvaluationFingerprint,
                metrics =
                    JsonSerializer.Deserialize<HennaXGBoostShadowBenchmarkMetrics>(
                        x.MetricsJson),
                x.CutoffUtc,
                x.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                active = false,
                runtimeApplied = false
            }).ToList();
            return Results.Ok(new { items, page = p, active = false });
        });

        routes.MapGet("/research/automation/readiness", async (
            IServiceProvider services, CancellationToken ct) =>
        {
            var plan = await services.GetRequiredService<AllocationLearningAutomationPlanner>()
                .BuildAsync(ct);
            return Results.Ok(new
            {
                plan.Status,
                plan.TriggerPolicyConfigured,
                plan.AutomaticTrainingEnabled,
                plan.MissingPolicyRequirements,
                cohorts = plan.Cohorts.Select(x => new
                {
                    x.DatasetVersion,
                    x.SourceInstructionReference,
                    x.RubricVersion,
                    x.TrainingLabelCount,
                    x.ValidationLabelCount,
                    x.DistinctTrainingHouseholds,
                    x.DistinctValidationHouseholds,
                    x.HouseholdPartitionOverlap,
                    x.LatestReviewedAtUtc,
                    x.MeetsConfiguredTrigger,
                    x.RequestId
                }),
                active = false
            });
        });

        routes.MapPost("/research/ebm-artifacts", async (
            AllocationEbmArtifactRequest input,
            HttpContext http,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.ArtifactBase64) ||
                input.Report.ValueKind != JsonValueKind.Object)
                return Results.BadRequest();
            byte[] artifactBytes;
            try
            {
                artifactBytes = Convert.FromBase64String(input.ArtifactBase64);
            }
            catch (FormatException)
            {
                return Results.BadRequest();
            }

            var row = await services
                .GetRequiredService<AllocationEbmArtifactService>()
                .RegisterAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.TrainingRunId,
                    artifactBytes,
                    input.Report.GetRawText(),
                    ct);
            return Results.Ok(new
            {
                row.Id,
                row.TrainingRunId,
                row.ModelVersion,
                row.ArtifactFormat,
                row.ArtifactSha256,
                row.LibraryName,
                row.LibraryVersion,
                artifactByteLength = row.ArtifactBytes.Length,
                row.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                proposalCreated = false,
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapGet("/research/ebm-artifacts", async (
            Guid? trainingRunId,
            int? page,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            if (trainingRunId == Guid.Empty) return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var query = db.EbmArtifacts.AsNoTracking().AsQueryable();
            if (trainingRunId is { } runId)
                query = query.Where(x => x.TrainingRunId == runId);
            var items = await query
                .OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .Select(x => new
                {
                    x.Id,
                    x.TrainingRunId,
                    x.ModelVersion,
                    x.ArtifactFormat,
                    x.ArtifactSha256,
                    x.LibraryName,
                    x.LibraryVersion,
                    artifactByteLength = x.ArtifactBytes.Length,
                    x.RecordedAtUtc,
                    winner = (string?)null,
                    approved = false,
                    active = false,
                    runtimeApplied = false
                })
                .ToListAsync(ct);
            return Results.Ok(new { items, page = p, active = false });
        });

        routes.MapPost("/research/ebm-benchmarks", async (
            AllocationEbmBenchmarkRequest input,
            HttpContext http,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            if (input.EvaluationLabelIds is null)
                return Results.BadRequest();
            var row = await services
                .GetRequiredService<AllocationEbmBenchmarkService>()
                .EvaluateAsync(
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.TrainingRunId,
                    input.EvaluationLabelIds,
                    input.CutoffUtc,
                    ct);
            var metrics = JsonSerializer.Deserialize<HennaEbmBenchmarkMetrics>(
                row.MetricsJson)
                ?? throw new InvalidOperationException(
                    "Stored EBM benchmark metrics are invalid.");
            return Results.Ok(new
            {
                row.Id,
                row.EbmArtifactId,
                row.TrainingRunId,
                row.ProtocolVersion,
                row.ModelVersion,
                row.ArtifactSha256,
                row.BaselineVersion,
                row.DatasetVersion,
                row.SourceInstructionReference,
                row.RuntimeProposalId,
                row.RuntimeProfileSequence,
                row.EvaluationFingerprint,
                metrics,
                row.CutoffUtc,
                row.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                proposalCreated = false,
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapGet("/research/ebm-benchmarks", async (
            string? evaluationFingerprint,
            int? page,
            IServiceProvider services,
            CancellationToken ct) =>
        {
            var p = page ?? 1;
            if (p is < 1 or > 10000) return Results.BadRequest();
            if (evaluationFingerprint is not null &&
                (evaluationFingerprint.Length != 64 ||
                 evaluationFingerprint.Any(x => !Uri.IsHexDigit(x))))
                return Results.BadRequest();
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            var query = db.EbmModelBenchmarks.AsNoTracking().AsQueryable();
            if (evaluationFingerprint is not null)
                query = query.Where(x =>
                    x.EvaluationFingerprint == evaluationFingerprint.ToLower());
            var rows = await query
                .OrderByDescending(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Skip((p - 1) * 20)
                .Take(20)
                .ToListAsync(ct);
            var items = rows.Select(x => new
            {
                x.Id,
                x.EbmArtifactId,
                x.TrainingRunId,
                x.ProtocolVersion,
                x.ModelVersion,
                x.ArtifactSha256,
                x.BaselineVersion,
                x.DatasetVersion,
                x.SourceInstructionReference,
                x.RuntimeProposalId,
                x.RuntimeProfileSequence,
                x.EvaluationFingerprint,
                metrics = JsonSerializer.Deserialize<HennaEbmBenchmarkMetrics>(
                    x.MetricsJson),
                x.CutoffUtc,
                x.RecordedAtUtc,
                winner = (string?)null,
                approved = false,
                proposalCreated = false,
                active = false,
                runtimeApplied = false
            }).ToList();
            return Results.Ok(new { items, page = p, active = false });
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
            using var shadowParameters = run.ShadowParametersJson is { } shadowParametersJson
                ? JsonDocument.Parse(shadowParametersJson) : null;
            using var shadowMetrics = run.ShadowMetricsJson is { } shadowMetricsJson
                ? JsonDocument.Parse(shadowMetricsJson) : null;
            var examples = inputs.RootElement.GetProperty("examples").EnumerateArray().ToArray();
            object? shadowModel = run.ShadowModelVersion is null ? null : new
            {
                modelVersion = run.ShadowModelVersion,
                artifactFormat = run.ShadowArtifactFormat,
                artifactSha256 = run.ShadowArtifactSha256,
                artifactByteLength = run.ShadowArtifactBytes?.Length,
                parameters = shadowParameters?.RootElement.Clone(),
                metrics = shadowMetrics?.RootElement.Clone(),
                proposalCreated = false,
                runtimeApplied = false
            };
            var ebm = await db.EbmArtifacts.AsNoTracking()
                .SingleOrDefaultAsync(x => x.TrainingRunId == id, ct);
            using var ebmReport = ebm is null
                ? null
                : JsonDocument.Parse(ebm.ReportJson);
            object? ebmModel = ebm is null ? null : new
            {
                id = ebm.Id,
                modelVersion = ebm.ModelVersion,
                artifactFormat = ebm.ArtifactFormat,
                artifactSha256 = ebm.ArtifactSha256,
                artifactByteLength = ebm.ArtifactBytes.Length,
                libraryName = ebm.LibraryName,
                libraryVersion = ebm.LibraryVersion,
                report = ebmReport?.RootElement.Clone(),
                winner = (string?)null,
                approved = false,
                proposalCreated = false,
                runtimeApplied = false
            };
            return Results.Ok(new { run.Id, run.Status, run.DatasetVersion, run.ModelVersion, run.ProposalId,
                run.RecordedAtUtc, run.CutoffUtc,
                poolRial = inputs.RootElement.GetProperty("poolRial").GetInt64(),
                sourceInstructionReference = inputs.RootElement.GetProperty("sourceInstructionReference").GetString(),
                rubricVersion = examples[0].GetProperty("RubricVersion").GetString(),
                trainingCount = examples.Count(x => x.GetProperty("Partition").GetInt32() == 1),
                validationCount = examples.Count(x => x.GetProperty("Partition").GetInt32() == 2),
                learningMetrics = metrics?.RootElement.Clone(),
                shadowModel,
                ebmModel,
                active = false });
        });

        routes.MapPost("/research/train", async (TrainAllocationRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            if (input.LabelIds is null) return Results.BadRequest();
            Guid? requestId = null;
            var keyHeader = http.Request.Headers["Idempotency-Key"].ToString();
            if (!string.IsNullOrWhiteSpace(keyHeader))
            {
                if (!Guid.TryParse(keyHeader, out var parsedKey) ||
                    parsedKey == Guid.Empty)
                    return Results.ValidationProblem(
                        new Dictionary<string, string[]>
                        {
                            ["idempotencyKey"] = ["کلید اجرای آموزش معتبر نیست."]
                        });
                requestId = parsedKey;
            }
            var run = await services.GetRequiredService<AllocationTrainingWorkflow>().TrainAsync(
                (Guid)http.Items["AllocationReviewerAccount"]!, input.LabelIds, input.PoolRial,
                input.CutoffUtc, requestId, ct);
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

        routes.MapGet("/{id:guid}/pilot", async (Guid id, IServiceProvider services,
            CancellationToken ct) =>
        {
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            if (!await db.Proposals.AsNoTracking().AnyAsync(x => x.Id == id, ct))
                return Results.NotFound();
            var events = await db.PilotEvents.AsNoTracking()
                .Where(x => x.ProposalId == id)
                .OrderBy(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.EventType,
                    x.ActorAccountId,
                    x.ScopeReference,
                    x.Reason,
                    x.RecordedAtUtc
                })
                .ToListAsync(ct);
            var status = events.LastOrDefault()?.EventType ?? "NOT_AUTHORIZED";
            return Results.Ok(new
            {
                proposalId = id,
                status,
                events,
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapPost("/{id:guid}/pilot/authorize", async (
            Guid id, AuthorizePilotRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services.GetRequiredService<AllocationPilotService>()
                .AuthorizeAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.ScopeReference,
                    input.Reason,
                    ct);
            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "PILOT_AUTHORIZED",
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapPost("/{id:guid}/pilot/complete", async (
            Guid id, PilotDecisionRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services.GetRequiredService<AllocationPilotService>()
                .CompleteAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);
            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "PILOT_COMPLETED",
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapPost("/{id:guid}/pilot/abort", async (
            Guid id, PilotDecisionRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services.GetRequiredService<AllocationPilotService>()
                .AbortAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);
            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "PILOT_ABORTED",
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapGet("/{id:guid}/production-control", async (
            Guid id, IServiceProvider services, CancellationToken ct) =>
        {
            var db = services.GetRequiredService<HanaAllocationLearningDbContext>();
            if (!await db.Proposals.AsNoTracking().AnyAsync(x => x.Id == id, ct))
                return Results.NotFound();

            var events = await db.ProductionControlEvents.AsNoTracking()
                .Where(x => x.ProposalId == id)
                .OrderBy(x => x.RecordedAtUtc)
                .ThenBy(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.EventType,
                    x.ActorAccountId,
                    x.Reason,
                    x.RecordedAtUtc
                })
                .ToListAsync(ct);

            var activationAuthorized = events.Any(
                x => x.EventType == "PRODUCTION_ACTIVATION_AUTHORIZED");
            var rollbackAuthorized = events.Any(
                x => x.EventType == "PRODUCTION_ROLLBACK_AUTHORIZED");

            return Results.Ok(new
            {
                proposalId = id,
                activationAuthorized,
                rollbackAuthorized,
                events,
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapPost("/{id:guid}/production-control/authorize-activation", async (
            Guid id, ProductionControlRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services
                .GetRequiredService<AllocationProductionControlService>()
                .AuthorizeActivationAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);

            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "PRODUCTION_ACTIVATION_AUTHORIZED",
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapPost("/{id:guid}/production-control/authorize-rollback", async (
            Guid id, ProductionControlRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services
                .GetRequiredService<AllocationProductionControlService>()
                .AuthorizeRollbackAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);

            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "PRODUCTION_ROLLBACK_AUTHORIZED",
                active = false,
                runtimeApplied = false
            });
        });

        routes.MapGet("/runtime-profile", async (
            IServiceProvider services, CancellationToken ct) =>
        {
            var current = await services
                .GetRequiredService<IAllocationRuntimeProfileProvider>()
                .CurrentAsync(ct);
            return Results.Ok(new
            {
                runtimeSequence = current.Sequence,
                proposalId = current.ProposalId,
                profileVersion = current.Profile.Version,
                weights = current.Profile,
                active = current.ProposalId is not null,
                runtimeApplied = current.ProposalId is not null
            });
        });

        routes.MapPost("/{id:guid}/runtime/promote", async (
            Guid id, RuntimePromotionRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services
                .GetRequiredService<AllocationRuntimePromotionService>()
                .PromoteAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);
            var current = await services
                .GetRequiredService<IAllocationRuntimeProfileProvider>()
                .CurrentAsync(ct);
            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "RUNTIME_PROMOTED",
                runtimeSequence = current.Sequence,
                profileVersion = current.Profile.Version,
                active = current.ProposalId == id,
                runtimeApplied = current.ProposalId == id
            });
        });

        routes.MapPost("/{id:guid}/runtime/rollback", async (
            Guid id, RuntimePromotionRequest input, HttpContext http,
            IServiceProvider services, CancellationToken ct) =>
        {
            var eventId = await services
                .GetRequiredService<AllocationRuntimePromotionService>()
                .RollbackAsync(
                    id,
                    (Guid)http.Items["AllocationReviewerAccount"]!,
                    input.Reason,
                    ct);
            var current = await services
                .GetRequiredService<IAllocationRuntimeProfileProvider>()
                .CurrentAsync(ct);
            return Results.Ok(new
            {
                id = eventId,
                proposalId = id,
                status = "RUNTIME_ROLLED_BACK",
                effectiveProposalId = current.ProposalId,
                runtimeSequence = current.Sequence,
                profileVersion = current.Profile.Version,
                active = current.ProposalId is not null,
                runtimeApplied = current.ProposalId is not null
            });
        });
    }
}

internal sealed record ProposalWeights(decimal Health, decimal Hardship, decimal Age,
    decimal Size, decimal Care, decimal Education);
internal sealed record SubmitProposalRequest(string CandidateVersion, string ModelVersion, string Rationale,
    ProposalWeights? Weights, Guid[]? SnapshotIds, long PoolRial, string DatasetVersion,
    string SourceInstructionReference);
internal sealed record ReviewProposalRequest(string Decision, string Reason);
internal sealed record AuthorizePilotRequest(string ScopeReference, string Reason);
internal sealed record PilotDecisionRequest(string Reason);
internal sealed record AllocationRetentionPurgeRequest(
    DateTimeOffset CutoffUtc,
    string PreviewDigest,
    string Reason);
internal sealed record AllocationModelBenchmarkRequest(
    Guid ProposalId,
    Guid[]? EvaluationLabelIds,
    DateTimeOffset CutoffUtc);
internal sealed record AllocationShadowModelBenchmarkRequest(
    Guid TrainingRunId,
    Guid[]? EvaluationLabelIds,
    DateTimeOffset CutoffUtc);
internal sealed record AllocationEbmArtifactRequest(
    Guid TrainingRunId,
    string? ArtifactBase64,
    JsonElement Report);
internal sealed record AllocationEbmBenchmarkRequest(
    Guid TrainingRunId,
    Guid[]? EvaluationLabelIds,
    DateTimeOffset CutoffUtc);
internal sealed record ProductionControlRequest(string Reason);
internal sealed record RuntimePromotionRequest(string Reason);

internal sealed record CaptureReviewedOutcomeRequest(
    Guid EventId,
    Guid SnapshotId,
    DateTimeOffset PeriodStartUtc,
    DateTimeOffset PeriodEndUtc,
    decimal? EssentialNeedsCoverage,
    bool? StockBarrier,
    bool? DeliveryBarrier,
    bool? AccessBarrier,
    string EvidenceReference);
internal sealed record NeedLabelRequest(Guid SnapshotId, decimal NeedScore, string RubricVersion, int Partition);
internal sealed record TrainAllocationRequest(Guid[]? LabelIds, long PoolRial, DateTimeOffset CutoffUtc);

internal sealed record AssessmentScores(int? Health, int? Hardship, int? Age, int? Size, int? Care, int? Education);
internal sealed record CaptureAssessmentRequest(Guid SnapshotId, Guid HouseholdKey, AssessmentScores? Scores,
    decimal? GeographicFactor, long? AllocatedRial, DateTimeOffset? AssessedAtUtc,
    string DatasetVersion, string SourceInstructionReference, string EvidenceReference);
