using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationEbmArtifactRecord
{
    public Guid Id { get; set; }
    public Guid TrainingRunId { get; set; }
    public Guid RegisteredByAccountId { get; set; }
    public string ModelVersion { get; set; } = "";
    public string ArtifactFormat { get; set; } = "";
    public string ArtifactSha256 { get; set; } = "";
    public byte[] ArtifactBytes { get; set; } = [];
    public string LibraryName { get; set; } = "";
    public string LibraryVersion { get; set; } = "";
    public string ReportJson { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed record HennaEbmBenchmarkMetrics(
    int EvaluationCount,
    double BaselineMse,
    double EbmMse,
    double EbmMinusBaselineMse,
    string RubricVersion,
    string EvaluationFingerprint,
    DateTimeOffset CutoffUtc,
    RegressionDiagnosticMetrics? BaselineDiagnostics,
    RegressionDiagnosticMetrics? EbmDiagnostics);

public sealed class AllocationEbmBenchmarkRecord
{
    public Guid Id { get; set; }
    public Guid EbmArtifactId { get; set; }
    public Guid TrainingRunId { get; set; }
    public Guid EvaluatedByAccountId { get; set; }
    public string ProtocolVersion { get; set; } = "";
    public string ModelVersion { get; set; } = "";
    public string ArtifactSha256 { get; set; } = "";
    public string BaselineVersion { get; set; } = "";
    public string DatasetVersion { get; set; } = "";
    public string SourceInstructionReference { get; set; } = "";
    public Guid? RuntimeProposalId { get; set; }
    public long? RuntimeProfileSequence { get; set; }
    public string EvaluationLabelIdsJson { get; set; } = "";
    public string EvaluationFingerprint { get; set; } = "";
    public string MetricsJson { get; set; } = "";
    public DateTimeOffset CutoffUtc { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class AllocationEbmArtifactConflictException(string message)
    : Exception(message) { }

public sealed class AllocationEbmBenchmarkConflictException(string message)
    : Exception(message) { }

internal sealed record HennaEbmPortableArtifact(
    string Sha256,
    double[] PredictionLookup);

internal static class HennaEbmPortableArtifactVerifier
{
    public const string ModelVersion = "henna-ebm-v1-offline";
    public const string ArtifactFormat = "henna-ebm-portable-json-v1";
    public const string LibraryName = "interpret-core";
    public const string LibraryVersion = "0.7.8";
    public const string PredictionLookupIndex = "base4(featureOrder)";
    private static readonly string[] FeatureOrder =
        ["health", "hardship", "age", "size", "care", "education"];

    public static HennaEbmPortableArtifact Verify(
        byte[] artifactBytes,
        string? expectedSha256 = null)
    {
        ArgumentNullException.ThrowIfNull(artifactBytes);
        if (artifactBytes.Length is < 2 or > 16 * 1024 * 1024)
            throw new ArgumentException(
                "EBM artifact must be non-empty and within the research artifact size limit.");

        var sha = Convert.ToHexString(SHA256.HashData(artifactBytes))
            .ToLowerInvariant();
        if (expectedSha256 is not null &&
            !string.Equals(sha, expectedSha256,
                StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Stored EBM artifact attestation is invalid.");

        using var document = JsonDocument.Parse(artifactBytes);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            root.GetProperty("schema").GetString() != ArtifactFormat ||
            root.GetProperty("modelVersion").GetString() != ModelVersion ||
            root.GetProperty("predictionLookupIndex").GetString() !=
                PredictionLookupIndex)
            throw new ArgumentException(
                "EBM artifact identity or schema is invalid.");

        var library = root.GetProperty("library");
        if (library.GetProperty("name").GetString() != LibraryName ||
            library.GetProperty("version").GetString() != LibraryVersion)
            throw new ArgumentException(
                "EBM artifact library identity is invalid.");

        var featureOrder = root.GetProperty("featureOrder")
            .EnumerateArray().Select(x => x.GetString()).ToArray();
        if (!featureOrder.SequenceEqual(FeatureOrder))
            throw new ArgumentException(
                "EBM artifact feature order is invalid.");

        var domain = root.GetProperty("featureDomain")
            .EnumerateArray().Select(x => x.GetInt32()).ToArray();
        if (!domain.SequenceEqual(new[] { 0, 1, 2, 3 }))
            throw new ArgumentException(
                "EBM artifact feature domain is invalid.");

        if (root.GetProperty("officialInterpretMlModel").ValueKind !=
            JsonValueKind.Object)
            throw new ArgumentException(
                "Official InterpretML model payload is required.");

        var lookup = root.GetProperty("predictionLookup")
            .EnumerateArray().Select(x => x.GetDouble()).ToArray();
        if (lookup.Length != 4096 ||
            lookup.Any(x => !double.IsFinite(x)))
            throw new ArgumentException(
                "EBM prediction lookup must contain 4096 finite values.");

        return new(sha, lookup);
    }

    public static double Predict(double[] lookup, HouseholdNeedScores scores)
    {
        ArgumentNullException.ThrowIfNull(lookup);
        ArgumentNullException.ThrowIfNull(scores);
        if (lookup.Length != 4096)
            throw new ArgumentException("EBM lookup shape is invalid.");
        var values = new[]
        {
            scores.Health,
            scores.EconomicHardship,
            scores.AgeAndDependency,
            scores.HouseholdSize,
            scores.CareAndSupport,
            scores.Education
        };
        if (values.Any(x => x is < 0 or > 3))
            throw new ArgumentException("EBM feature score is outside 0..3.");

        var index = 0;
        foreach (var value in values)
            index = checked(index * 4 + value);
        var prediction = lookup[index];
        if (!double.IsFinite(prediction))
            throw new InvalidOperationException(
                "EBM lookup prediction is not finite.");
        return prediction;
    }
}

public sealed class AllocationEbmArtifactService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<AllocationEbmArtifactRecord> RegisterAsync(
        Guid actor,
        Guid trainingRunId,
        byte[] artifactBytes,
        string reportJson,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        if (trainingRunId == Guid.Empty ||
            string.IsNullOrWhiteSpace(reportJson))
            throw new ArgumentException(
                "Training run and EBM report are required.");

        var run = await db.TrainingRuns.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == trainingRunId, ct)
            ?? throw new ArgumentException("Training run does not exist.");

        var portable = HennaEbmPortableArtifactVerifier.Verify(
            artifactBytes);
        ValidateReportAndFrozenRun(
            run, portable, artifactBytes, reportJson);

        var existing = await db.EbmArtifacts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TrainingRunId == trainingRunId, ct);
        if (existing is not null)
        {
            if (existing.ModelVersion !=
                    HennaEbmPortableArtifactVerifier.ModelVersion ||
                existing.ArtifactFormat !=
                    HennaEbmPortableArtifactVerifier.ArtifactFormat ||
                existing.ArtifactSha256 != portable.Sha256)
                throw new AllocationEbmArtifactConflictException(
                    "Training run already has different EBM evidence.");
            return existing;
        }

        var row = new AllocationEbmArtifactRecord
        {
            Id = ArtifactId(trainingRunId, portable.Sha256),
            TrainingRunId = trainingRunId,
            RegisteredByAccountId = actor,
            ModelVersion = HennaEbmPortableArtifactVerifier.ModelVersion,
            ArtifactFormat = HennaEbmPortableArtifactVerifier.ArtifactFormat,
            ArtifactSha256 = portable.Sha256,
            ArtifactBytes = artifactBytes,
            LibraryName = HennaEbmPortableArtifactVerifier.LibraryName,
            LibraryVersion = HennaEbmPortableArtifactVerifier.LibraryVersion,
            ReportJson = reportJson,
            RecordedAtUtc = clock.UtcNow
        };
        db.EbmArtifacts.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException
                { SqlState: "23505" })
        {
            var replay = await db.EbmArtifacts.AsNoTracking()
                .SingleAsync(x => x.TrainingRunId == trainingRunId, ct);
            if (replay.ArtifactSha256 != portable.Sha256)
                throw new AllocationEbmArtifactConflictException(
                    "Concurrent EBM evidence differs for the same training run.");
            return replay;
        }
        return row;
    }

    private static void ValidateReportAndFrozenRun(
        AllocationTrainingRunRecord run,
        HennaEbmPortableArtifact portable,
        byte[] artifactBytes,
        string reportJson)
    {
        using var report = JsonDocument.Parse(reportJson);
        var root = report.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            root.GetProperty("modelVersion").GetString() !=
                HennaEbmPortableArtifactVerifier.ModelVersion ||
            root.GetProperty("artifactFormat").GetString() !=
                HennaEbmPortableArtifactVerifier.ArtifactFormat ||
            !string.Equals(
                root.GetProperty("artifactSha256").GetString(),
                portable.Sha256,
                StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("EBM report identity is invalid.");

        var library = root.GetProperty("library");
        if (library.GetProperty("name").GetString() !=
                HennaEbmPortableArtifactVerifier.LibraryName ||
            library.GetProperty("version").GetString() !=
                HennaEbmPortableArtifactVerifier.LibraryVersion)
            throw new ArgumentException("EBM report library is invalid.");

        var execution = root.GetProperty("execution");
        if (execution.GetProperty("engine").GetString() !=
                "HENNA_OWNED_LOCAL" ||
            execution.GetProperty("mode").GetString() !=
                "OFFLINE_RESEARCH_CHALLENGER" ||
            execution.GetProperty("networkModelApi").GetBoolean() ||
            execution.GetProperty("dataOrigin").GetString() !=
                "HENNA_FIRST_PARTY")
            throw new ArgumentException(
                "EBM report execution boundary is invalid.");

        var parameters = root.GetProperty("parameters");
        if (parameters.GetProperty("interactions").GetInt32() != 0 ||
            parameters.GetProperty("monotone_constraints").ValueKind !=
                JsonValueKind.Null)
            throw new ArgumentException(
                "EBM v1 interactions or monotonic constraints are not approved.");

        var governance = root.GetProperty("governance");
        if (governance.GetProperty("winner").ValueKind != JsonValueKind.Null ||
            governance.GetProperty("approved").GetBoolean() ||
            governance.GetProperty("proposalCreated").GetBoolean() ||
            governance.GetProperty("pilotAuthorized").GetBoolean() ||
            governance.GetProperty("runtimeApplied").GetBoolean())
            throw new ArgumentException(
                "EBM report contains forbidden governance state.");

        using var inputs = JsonDocument.Parse(run.InputsJson);
        var examples = JsonSerializer.Deserialize<ReviewedNeedExample[]>(
            inputs.RootElement.GetProperty("examples").GetRawText())
            ?? throw new InvalidOperationException(
                "Training run frozen examples are invalid.");
        if (examples.Length is < 40 or > 500 ||
            examples.Any(x =>
                x.Partition == LearningPartition.Evaluation ||
                x.Partition is not (
                    LearningPartition.Training or
                    LearningPartition.Validation)))
            throw new InvalidOperationException(
                "Training run partitions are invalid for EBM evidence.");

        var training = examples
            .Where(x => x.Partition == LearningPartition.Training)
            .ToArray();
        var validation = examples
            .Where(x => x.Partition == LearningPartition.Validation)
            .ToArray();
        var metrics = root.GetProperty("metrics");
        if (metrics.GetProperty("trainingCount").GetInt32() !=
                training.Length ||
            metrics.GetProperty("validationCount").GetInt32() !=
                validation.Length ||
            metrics.GetProperty("rubricVersion").GetString() !=
                examples[0].RubricVersion ||
            metrics.GetProperty("cutoffUtc").GetDateTimeOffset() !=
                run.CutoffUtc)
            throw new ArgumentException(
                "EBM report does not match frozen training lineage.");

        var trainingMse = Mse(
            training, portable.PredictionLookup);
        var validationMse = Mse(
            validation, portable.PredictionLookup);
        if (!Close(
                trainingMse,
                metrics.GetProperty("trainingMse").GetDouble()) ||
            !Close(
                validationMse,
                metrics.GetProperty("validationMse").GetDouble()))
            throw new ArgumentException(
                "EBM metrics do not reproduce from the frozen artifact.");

        var artifactText = Encoding.UTF8.GetString(artifactBytes);
        foreach (var example in examples)
        {
            if (artifactText.Contains(
                    example.HouseholdKey.ToString(),
                    StringComparison.OrdinalIgnoreCase) ||
                artifactText.Contains(
                    example.ReviewerKey.ToString(),
                    StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException(
                    "EBM artifact must not contain household or reviewer identifiers.");
        }
    }

    private static double Mse(
        IReadOnlyList<ReviewedNeedExample> examples,
        double[] lookup)
    {
        if (examples.Count == 0)
            throw new ArgumentException("EBM metric partition is empty.");
        double total = 0;
        foreach (var example in examples)
        {
            var residual =
                HennaEbmPortableArtifactVerifier.Predict(
                    lookup, example.Scores) -
                (double)example.ReviewedNeedScore;
            total += residual * residual;
        }
        var value = total / examples.Count;
        if (!double.IsFinite(value))
            throw new InvalidOperationException("EBM MSE is not finite.");
        return value;
    }

    private static bool Close(double left, double right) =>
        double.IsFinite(left) && double.IsFinite(right) &&
        Math.Abs(left - right) <=
            1e-10 * Math.Max(1d, Math.Max(Math.Abs(left), Math.Abs(right)));

    internal static Guid ArtifactId(
        Guid trainingRunId,
        string artifactSha256)
    {
        if (trainingRunId == Guid.Empty ||
            artifactSha256.Length != 64 ||
            artifactSha256.Any(x => !Uri.IsHexDigit(x)))
            throw new ArgumentException(
                "Complete EBM artifact identity is required.");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(
            $"henna-ebm-artifact-v1|{trainingRunId:D}|{artifactSha256.ToLowerInvariant()}"));
        return new Guid(hash.AsSpan(0, 16));
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }
}

public static class HennaEbmBenchmarkEvaluator
{
    public const string ProtocolVersion =
        "henna-ebm-shadow-benchmark-v2";

    public static HennaEbmBenchmarkMetrics Evaluate(
        IReadOnlyList<ReviewedNeedExample> examples,
        AllocationWeightProfile baseline,
        double[] lookup,
        DateTimeOffset cutoffUtc)
    {
        ArgumentNullException.ThrowIfNull(examples);
        ArgumentNullException.ThrowIfNull(baseline);
        ArgumentNullException.ThrowIfNull(lookup);
        if (cutoffUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("UTC cutoff required.");

        var data = examples.OrderBy(x => x?.HouseholdKey).ToArray();
        if (data.Length is < 1 or > 500 ||
            data.Any(x =>
                x is null ||
                x.HouseholdKey == Guid.Empty ||
                x.ReviewerKey == Guid.Empty ||
                x.Scores is null ||
                x.ReviewedNeedScore is < 0m or > 1m ||
                string.IsNullOrWhiteSpace(x.RubricVersion) ||
                x.RubricVersion.Length > 120 ||
                x.ReviewedAtUtc.Offset != TimeSpan.Zero ||
                x.ReviewedAtUtc > cutoffUtc ||
                x.Partition != LearningPartition.Evaluation) ||
            data.Select(x => x.HouseholdKey).Distinct().Count() != data.Length)
            throw new ArgumentException(
                "Complete distinct independent evaluation labels are required.");
        if (data.Select(x => x.RubricVersion).Distinct().Count() != 1)
            throw new ArgumentException(
                "One reviewed evaluation rubric is required.");

        var observed = data
            .Select(x => (double)x.ReviewedNeedScore)
            .ToArray();
        var baselinePredictions = data.Select(x =>
            (double)(
                baseline.Health * x.Scores.Health / 3m +
                baseline.Hardship * x.Scores.EconomicHardship / 3m +
                baseline.Age * x.Scores.AgeAndDependency / 3m +
                baseline.Size * x.Scores.HouseholdSize / 3m +
                baseline.Care * x.Scores.CareAndSupport / 3m +
                baseline.Education * x.Scores.Education / 3m))
            .ToArray();
        var ebmPredictions = data
            .Select(x => HennaEbmPortableArtifactVerifier.Predict(
                lookup, x.Scores))
            .ToArray();
        var baselineDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                observed, baselinePredictions);
        var ebmDiagnostics =
            RegressionDiagnosticEvaluator.Evaluate(
                observed, ebmPredictions);
        var baselineMse = baselineDiagnostics.Mse;
        var ebmMse = ebmDiagnostics.Mse;

        var fingerprint =
            AllocationModelBenchmarkEvaluator.ComputeEvaluationFingerprint(
                data, baseline, cutoffUtc);
        return new(
            data.Length,
            baselineMse,
            ebmMse,
            ebmMse - baselineMse,
            data[0].RubricVersion,
            fingerprint,
            cutoffUtc,
            baselineDiagnostics,
            ebmDiagnostics);
    }
}

public sealed class AllocationEbmBenchmarkService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public async Task<AllocationEbmBenchmarkRecord> EvaluateAsync(
        Guid actor,
        Guid trainingRunId,
        IReadOnlyList<Guid> evaluationLabelIds,
        DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ArgumentNullException.ThrowIfNull(evaluationLabelIds);
        var labelIds = evaluationLabelIds.OrderBy(x => x).ToArray();
        if (trainingRunId == Guid.Empty ||
            labelIds.Length is < 1 or > 500 ||
            labelIds.Any(x => x == Guid.Empty) ||
            labelIds.Distinct().Count() != labelIds.Length)
            throw new ArgumentException(
                "Training run and 1–500 distinct evaluation labels are required.");
        if (cutoffUtc.Offset != TimeSpan.Zero ||
            cutoffUtc > clock.UtcNow)
            throw new ArgumentException(
                "A past UTC benchmark cutoff is required.");

        var run = await db.TrainingRuns.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == trainingRunId, ct)
            ?? throw new ArgumentException("Training run does not exist.");
        var artifact = await db.EbmArtifacts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TrainingRunId == trainingRunId, ct)
            ?? throw new ArgumentException(
                "Training run has no registered EBM artifact.");

        var portable = HennaEbmPortableArtifactVerifier.Verify(
            artifact.ArtifactBytes, artifact.ArtifactSha256);

        using var inputs = JsonDocument.Parse(run.InputsJson);
        var root = inputs.RootElement;
        var baseline = JsonSerializer.Deserialize<AllocationWeightProfile>(
            root.GetProperty("baseline").GetRawText())
            ?? throw new InvalidOperationException(
                "Training run baseline is invalid.");
        var sourceInstructionReference =
            root.GetProperty("sourceInstructionReference").GetString()
            ?? throw new InvalidOperationException(
                "Training run source instruction is invalid.");
        var runtimeProposalElement =
            root.GetProperty("baselineRuntimeProposalId");
        var runtimeProposalId =
            runtimeProposalElement.ValueKind == JsonValueKind.Null
                ? (Guid?)null
                : runtimeProposalElement.GetGuid();
        var runtimeSequenceElement =
            root.GetProperty("baselineRuntimeProfileSequence");
        var runtimeProfileSequence =
            runtimeSequenceElement.ValueKind == JsonValueKind.Null
                ? (long?)null
                : runtimeSequenceElement.GetInt64();

        var frozenExamples =
            JsonSerializer.Deserialize<ReviewedNeedExample[]>(
                root.GetProperty("examples").GetRawText())
            ?? throw new InvalidOperationException(
                "Training run frozen examples are invalid.");
        var frozenHouseholds = frozenExamples
            .Select(x => x.HouseholdKey)
            .ToHashSet();

        var labels = await db.NeedLabels.AsNoTracking()
            .Where(x => labelIds.Contains(x.Id))
            .OrderBy(x => x.Id)
            .ToArrayAsync(ct);
        if (labels.Length != labelIds.Length ||
            labels.Any(x =>
                x.Partition != (int)LearningPartition.Evaluation ||
                x.ReviewedAtUtc > cutoffUtc))
            throw new ArgumentException(
                "All benchmark labels must exist, be Evaluation-only and precede the cutoff.");

        var snapshotIds = labels.Select(x => x.SnapshotId).ToArray();
        var snapshots = await db.Assessments.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        if (snapshots.Count != snapshotIds.Distinct().Count())
            throw new ArgumentException(
                "Benchmark assessment snapshots are incomplete.");

        var rows = labels.Select(x => snapshots[x.SnapshotId]).ToArray();
        if (rows.Any(x => frozenHouseholds.Contains(x.HouseholdKey)))
            throw new ArgumentException(
                "Independent evaluation households must not overlap the training run.");

        var lineage = await AllocationTrainingLineageResolver.ResolveEligibleAsync(
            db, rows, ct);
        if (lineage.Count != rows.Length)
            throw new ArgumentException(
                "Benchmark labels require valid first-party runtime lineage.");

        var lineages = rows.Select(x => lineage[x.Id]).ToArray();
        if (rows.Any(x =>
                x.FormulaVersion != baseline.Version ||
                x.DatasetVersion != run.DatasetVersion ||
                x.SourceInstructionReference !=
                    sourceInstructionReference) ||
            lineages.Any(x =>
                x.RuntimeProposalId != runtimeProposalId ||
                x.RuntimeProfileSequence != runtimeProfileSequence ||
                x.Baseline != baseline))
            throw new ArgumentException(
                "Benchmark labels must match the training run baseline lineage, dataset and funding instruction.");

        var examples = labels.Select(x =>
        {
            var s = snapshots[x.SnapshotId];
            return new ReviewedNeedExample(
                s.HouseholdKey,
                new(
                    s.Health,
                    s.Hardship,
                    s.Age,
                    s.Size,
                    s.Care,
                    s.Education),
                x.NeedScore,
                x.ReviewerAccountId,
                x.RubricVersion,
                x.ReviewedAtUtc,
                LearningPartition.Evaluation);
        }).ToArray();

        var metrics = HennaEbmBenchmarkEvaluator.Evaluate(
            examples,
            baseline,
            portable.PredictionLookup,
            cutoffUtc);
        var id = BenchmarkId(
            artifact.Id,
            metrics.EvaluationFingerprint,
            HennaEbmBenchmarkEvaluator.ProtocolVersion);

        var existing = await db.EbmModelBenchmarks.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (existing is not null)
        {
            EnsureReplayMatches(
                existing,
                artifact.Id,
                trainingRunId,
                actor,
                metrics.EvaluationFingerprint,
                cutoffUtc);
            return existing;
        }

        var row = new AllocationEbmBenchmarkRecord
        {
            Id = id,
            EbmArtifactId = artifact.Id,
            TrainingRunId = trainingRunId,
            EvaluatedByAccountId = actor,
            ProtocolVersion =
                HennaEbmBenchmarkEvaluator.ProtocolVersion,
            ModelVersion = artifact.ModelVersion,
            ArtifactSha256 = artifact.ArtifactSha256,
            BaselineVersion = baseline.Version,
            DatasetVersion = run.DatasetVersion,
            SourceInstructionReference =
                sourceInstructionReference,
            RuntimeProposalId = runtimeProposalId,
            RuntimeProfileSequence = runtimeProfileSequence,
            EvaluationLabelIdsJson = JsonSerializer.Serialize(labelIds),
            EvaluationFingerprint = metrics.EvaluationFingerprint,
            MetricsJson = JsonSerializer.Serialize(metrics),
            CutoffUtc = cutoffUtc,
            RecordedAtUtc = clock.UtcNow
        };
        db.EbmModelBenchmarks.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException
                { SqlState: "23505" })
        {
            var replay = await db.EbmModelBenchmarks.AsNoTracking()
                .SingleAsync(x => x.Id == id, ct);
            EnsureReplayMatches(
                replay,
                artifact.Id,
                trainingRunId,
                actor,
                metrics.EvaluationFingerprint,
                cutoffUtc);
            return replay;
        }

        return row;
    }

    private static void EnsureReplayMatches(
        AllocationEbmBenchmarkRecord existing,
        Guid artifactId,
        Guid trainingRunId,
        Guid actor,
        string evaluationFingerprint,
        DateTimeOffset cutoffUtc)
    {
        if (existing.EbmArtifactId != artifactId ||
            existing.TrainingRunId != trainingRunId ||
            existing.EvaluatedByAccountId != actor ||
            existing.EvaluationFingerprint != evaluationFingerprint ||
            existing.CutoffUtc != cutoffUtc)
            throw new AllocationEbmBenchmarkConflictException(
                "EBM benchmark identity was reused with different input.");
    }

    internal static Guid BenchmarkId(
        Guid artifactId,
        string evaluationFingerprint,
        string protocolVersion)
    {
        if (artifactId == Guid.Empty ||
            string.IsNullOrWhiteSpace(evaluationFingerprint) ||
            string.IsNullOrWhiteSpace(protocolVersion))
            throw new ArgumentException(
                "Complete EBM benchmark identity input is required.");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{protocolVersion}|{artifactId:D}|{evaluationFingerprint}"));
        return new Guid(hash.AsSpan(0, 16));
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }
}
