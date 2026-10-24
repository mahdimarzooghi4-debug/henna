using System.Text.Json;
using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationCrossModelSourceAlignmentTests
{
    private static readonly Guid XRun = Guid.Parse("a0000000-0000-4000-8000-000000000001");
    private static readonly Guid XEvaluation = Guid.Parse("a0000000-0000-4000-8000-000000000002");
    private static readonly Guid ERun = Guid.Parse("a0000000-0000-4000-8000-000000000003");
    private static readonly Guid EArtifact = Guid.Parse("a0000000-0000-4000-8000-000000000004");
    private static readonly Guid EEvaluation = Guid.Parse("a0000000-0000-4000-8000-000000000005");
    private static readonly Guid One = Guid.Parse("a0000000-0000-4000-8000-000000000006");
    private static readonly Guid Two = Guid.Parse("a0000000-0000-4000-8000-000000000007");
    private static readonly Guid Other = Guid.Parse("a0000000-0000-4000-8000-000000000008");
    private static readonly DateTimeOffset Cutoff =
        new(2026,10,7,12,0,0,TimeSpan.Zero);
    private static readonly string Fingerprint = new('a', 64);

    private static (CrossModelSourceSelection Selection,
        ResearchEvaluationSourceReverification X,
        ResearchEvaluationSourceReverification E,
        AllocationShadowModelBenchmarkRecord XRow,
        AllocationEbmBenchmarkRecord ERow) Fixture()
    {
        var selection = new CrossModelSourceSelection(XRun, XEvaluation, EArtifact, EEvaluation);
        var x = new ResearchEvaluationSourceReverification(
            AllocationEvaluationSourceReverificationService.ContractVersion,
            "XGBOOST", XRun, XRun, XEvaluation, new string('b',64),
            Fingerprint, "dataset", HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion,
            AllocationEvaluationSourceReverificationService.Status, 2,
            true, true, true, false, false, false, false, false);
        var e = x with {
            Family = "EBM", ArtifactId = EArtifact, TrainingRunId = ERun,
            EvaluationId = EEvaluation, ArtifactSha256 = new string('c',64),
            EvaluationProtocolVersion = HennaEbmBenchmarkEvaluator.ProtocolVersion
        };
        var ids = JsonSerializer.Serialize(new[] { One, Two }.OrderBy(i => i));
        var rubricJson = JsonSerializer.Serialize(new { RubricVersion = "rubric-eval" });
        var xb = new AllocationShadowModelBenchmarkRecord {
            Id = XEvaluation, TrainingRunId = XRun,
            ArtifactSha256 = x.ArtifactSha256, EvaluationFingerprint = Fingerprint,
            DatasetVersion = "dataset", BaselineVersion = "baseline",
            SourceInstructionReference = "program-ref",
            RuntimeProfileSequence = 0, EvaluationLabelIdsJson = ids,
            MetricsJson = rubricJson, CutoffUtc = Cutoff
        };
        var eb = new AllocationEbmBenchmarkRecord {
            Id = EEvaluation, EbmArtifactId = EArtifact, TrainingRunId = ERun,
            ArtifactSha256 = e.ArtifactSha256, EvaluationFingerprint = Fingerprint,
            DatasetVersion = "dataset", BaselineVersion = "baseline",
            SourceInstructionReference = "program-ref",
            RuntimeProfileSequence = 0, EvaluationLabelIdsJson = ids,
            MetricsJson = rubricJson, CutoffUtc = Cutoff
        };
        return (selection, x, e, xb, eb);
    }

    [Fact]
    public void IdenticalReverifiedEvaluationEvidenceDoesNotSelectWinner()
    {
        var f = Fixture();
        var result = AllocationCrossModelSourceAlignmentService.Compare(
            f.Selection, f.X, f.E, f.XRow, f.ERow);
        var replay = AllocationCrossModelSourceAlignmentService.Compare(
            f.Selection, f.X, f.E, f.XRow, f.ERow);
        Assert.Equal(result.ManifestSha256, replay.ManifestSha256);
        Assert.True(result.EvaluationLineageAligned);
        Assert.True(result.BothStoredContentsReverified);
        Assert.Equal(AllocationCrossModelSourceAlignmentService.AlignedStatus, result.Status);
        Assert.False(result.ScientificComparabilityApproved);
        Assert.False(result.HistoricalSourceAuthenticityAttested);
        Assert.False(result.WinnerSelected);
        Assert.False(result.DatasetAdmitted);
        Assert.False(result.ModelRegistered);
        Assert.False(result.RuntimeApplied);
    }

    [Fact]
    public void DistinctRealReverifiedCohortsAreMismatchNotAutomaticRanking()
    {
        var f=Fixture();
        f.ERow.EvaluationLabelIdsJson = JsonSerializer.Serialize(
            new[] { One, Other }.OrderBy(i => i));
        var report = AllocationCrossModelSourceAlignmentService.Compare(
            f.Selection, f.X, f.E, f.XRow, f.ERow);
        Assert.False(report.EvaluationLineageAligned);
        Assert.Equal(AllocationCrossModelSourceAlignmentService.MismatchStatus, report.Status);
        Assert.False(report.WinnerSelected);
    }

    [Fact]
    public void TamperedOrIncompleteEvidenceFailsClosed()
    {
        var f = Fixture();
        Assert.Throws<InvalidOperationException>(() =>
            AllocationCrossModelSourceAlignmentService.Compare(
                f.Selection, f.X with { DatasetAdmitted = true }, f.E, f.XRow, f.ERow));
        Assert.Throws<InvalidOperationException>(() =>
            AllocationCrossModelSourceAlignmentService.Compare(
                f.Selection, f.X, f.E with { EvaluationId = XEvaluation }, f.XRow, f.ERow));
        Assert.Throws<InvalidOperationException>(() =>
            AllocationCrossModelSourceAlignmentService.Compare(
                f.Selection, f.X, f.E,
                f.XRow, new AllocationEbmBenchmarkRecord {
                    Id = EEvaluation, EbmArtifactId = EArtifact, TrainingRunId = ERun,
                    ArtifactSha256 = f.E.ArtifactSha256,
                    EvaluationFingerprint = Fingerprint,
                    DatasetVersion = "dataset", BaselineVersion = "baseline",
                    SourceInstructionReference = "program-ref",
                    RuntimeProfileSequence = 0,
                    EvaluationLabelIdsJson = JsonSerializer.Serialize(new[] { One }),
                    MetricsJson = f.ERow.MetricsJson, CutoffUtc = Cutoff
                }));
        Assert.Throws<ArgumentException>(() =>
            AllocationCrossModelSourceAlignmentService.Compare(
                f.Selection with { EbmEvaluationId = XEvaluation },
                f.X, f.E, f.XRow, f.ERow));
    }
}
