using Hana.Domain.Credit;
using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class HennaXGBoostRuntimeContractTests
{
    [Fact]
    public void AttestedCandidateExecutesInProcessAndPreservesEvidenceLineage()
    {
        var artifact = TrainArtifact();
        var trainingRunId = Guid.NewGuid();
        var benchmarkId = Guid.NewGuid();
        var fingerprint = new string('a', 64);
        var candidate = Candidate(
            artifact,
            trainingRunId,
            benchmarkId,
            fingerprint);

        var first = HennaXGBoostRuntimeContract.EvaluateRaw(
            candidate,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0));
        var replay = HennaXGBoostRuntimeContract.EvaluateRaw(
            candidate,
            new HouseholdNeedScores(3, 0, 0, 0, 0, 0));

        Assert.True(double.IsFinite(first.RawNeedScore));
        Assert.Equal(first.RawNeedScore, replay.RawNeedScore, 12);
        Assert.Equal(
            HennaXGBoostRuntimeContract.RuntimeContractVersion,
            first.RuntimeContractVersion);
        Assert.Equal(trainingRunId, first.TrainingRunId);
        Assert.Equal(benchmarkId, first.BenchmarkId);
        Assert.Equal(fingerprint, first.EvaluationFingerprint);
        Assert.Equal(artifact.ModelVersion, first.ModelVersion);
        Assert.Equal(artifact.ArtifactSha256, first.ArtifactSha256);
    }

    [Fact]
    public void ArtifactTamperingFailsClosedBeforeInference()
    {
        var artifact = TrainArtifact();
        var tampered = artifact.ArtifactBytes.ToArray();
        tampered[0] ^= 0x01;
        var candidate = Candidate(
            artifact,
            artifactBytes: tampered);

        var error = Assert.Throws<InvalidOperationException>(() =>
            HennaXGBoostRuntimeContract.EvaluateRaw(
                candidate,
                new HouseholdNeedScores(0, 3, 0, 0, 0, 0)));

        Assert.Contains("attestation", error.Message);
    }

    [Fact]
    public void RuntimeCandidateRequiresSelectedModelAndIndependentEvidenceIdentity()
    {
        var artifact = TrainArtifact();
        var valid = Candidate(artifact);

        Assert.Throws<ArgumentException>(() =>
            HennaXGBoostRuntimeContract.EvaluateRaw(
                valid with { ModelVersion = "other-model" },
                new HouseholdNeedScores(0, 0, 3, 0, 0, 0)));

        Assert.Throws<ArgumentException>(() =>
            HennaXGBoostRuntimeContract.EvaluateRaw(
                valid with { BenchmarkId = Guid.Empty },
                new HouseholdNeedScores(0, 0, 3, 0, 0, 0)));

        Assert.Throws<ArgumentException>(() =>
            HennaXGBoostRuntimeContract.EvaluateRaw(
                valid with { EvaluationFingerprint = "not-a-fingerprint" },
                new HouseholdNeedScores(0, 0, 3, 0, 0, 0)));
    }

    private static HennaXGBoostRuntimeCandidate Candidate(
        HennaXGBoostOfflineArtifact artifact,
        Guid? trainingRunId = null,
        Guid? benchmarkId = null,
        string? fingerprint = null,
        byte[]? artifactBytes = null) =>
        new(
            trainingRunId ?? Guid.NewGuid(),
            benchmarkId ?? Guid.NewGuid(),
            fingerprint ?? new string('b', 64),
            artifact.ModelVersion,
            artifact.ArtifactFormat,
            artifact.ArtifactSha256,
            artifactBytes ?? artifact.ArtifactBytes);

    private static HennaXGBoostOfflineArtifact TrainArtifact()
    {
        var cutoff = new DateTimeOffset(
            2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
        var reviewer = Guid.NewGuid();
        var target = new[]
        {
            .35m, .20m, .18m, .12m, .10m, .05m
        };
        var examples = Enumerable.Range(0, 40)
            .Select(i =>
            {
                var scores = Enumerable.Range(0, 6)
                    .Select(k => k == i % 6 ? 3 : 0)
                    .ToArray();
                return new ReviewedNeedExample(
                    Guid.NewGuid(),
                    new HouseholdNeedScores(
                        scores[0],
                        scores[1],
                        scores[2],
                        scores[3],
                        scores[4],
                        scores[5]),
                    target[i % 6],
                    reviewer,
                    "runtime-contract-rubric-v1",
                    cutoff.AddMinutes(-40 + i),
                    i < 30
                        ? LearningPartition.Training
                        : LearningPartition.Validation);
            })
            .ToArray();

        return HennaXGBoostOfflineLearner.Train(
            examples,
            cutoff);
    }
}
