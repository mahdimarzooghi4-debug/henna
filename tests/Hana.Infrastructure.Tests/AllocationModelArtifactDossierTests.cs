using System.Security.Cryptography;
using System.Text;
using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationModelArtifactDossierTests
{
    private static readonly byte[] Bytes = Encoding.UTF8.GetBytes("henna-dossier-local-artifact");
    private static readonly string Sha = Convert.ToHexString(SHA256.HashData(Bytes)).ToLowerInvariant();
    private static readonly DateTimeOffset When = new(2026, 10, 8, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void XgboostRejectsTamperingAndWrongBenchmarkIdentity()
    {
        var run = new AllocationTrainingRunRecord {
            Id = Guid.NewGuid(), DatasetVersion = "first-party",
            ShadowModelVersion = HennaXGBoostOfflineLearner.ModelVersion,
            ShadowArtifactFormat = HennaXGBoostOfflineLearner.ArtifactFormat,
            ShadowArtifactSha256 = Sha, ShadowArtifactBytes = Bytes, RecordedAtUtc = When
        };
        var b = new AllocationShadowModelBenchmarkRecord {
            Id = Guid.NewGuid(), TrainingRunId = run.Id,
            ModelVersion = run.ShadowModelVersion!, ArtifactSha256 = Sha,
            ProtocolVersion = "xgboost-shadow-v3", EvaluationFingerprint = Sha,
            DatasetVersion = run.DatasetVersion, SourceInstructionReference = "funding",
            CutoffUtc = When, RecordedAtUtc = When
        };
        var valid = AllocationModelArtifactDossierService.BuildXgboost(run, [b]);
        Assert.True(valid.ArtifactVerified);
        Assert.False(valid.Registered);
        Assert.False(valid.Approved);
        Assert.False(valid.RuntimeApplied);
        Assert.Single(valid.Evaluations);
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildXgboost(run, [b, b]));
        b.EvaluationFingerprint = "bad";
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildXgboost(run, [b]));
        b.EvaluationFingerprint = Sha;
        b.ArtifactSha256 = new string('0', 64);
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildXgboost(run, [b]));
        b.ArtifactSha256 = Sha;
        run.ShadowArtifactBytes = Encoding.UTF8.GetBytes("tampered");
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildXgboost(run, [b]));
    }

    [Fact]
    public void EbmRejectsCompetingArtifactAndRun()
    {
        var run = new AllocationTrainingRunRecord { Id = Guid.NewGuid(), DatasetVersion = "first-party" };
        var a = new AllocationEbmArtifactRecord {
            Id = Guid.NewGuid(), TrainingRunId = run.Id,
            ModelVersion = "henna-ebm-v1-offline",
            ArtifactFormat = "henna-ebm-portable-json-v1",
            ArtifactSha256 = Sha, ArtifactBytes = Bytes, RecordedAtUtc = When
        };
        var b = new AllocationEbmBenchmarkRecord {
            Id = Guid.NewGuid(), EbmArtifactId = a.Id, TrainingRunId = run.Id,
            ModelVersion = a.ModelVersion, ArtifactSha256 = Sha,
            ProtocolVersion = "ebm-v1", EvaluationFingerprint = Sha,
            DatasetVersion = run.DatasetVersion, SourceInstructionReference = "funding",
            CutoffUtc = When, RecordedAtUtc = When
        };
        var valid = AllocationModelArtifactDossierService.BuildEbm(a, run, [b]);
        Assert.Equal("EBM", valid.Family);
        Assert.False(valid.Active);
        b.EbmArtifactId = Guid.NewGuid();
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildEbm(a, run, [b]));
        b.EbmArtifactId = a.Id;
        b.TrainingRunId = Guid.NewGuid();
        Assert.Throws<InvalidOperationException>(() =>
            AllocationModelArtifactDossierService.BuildEbm(a, run, [b]));
    }
}
