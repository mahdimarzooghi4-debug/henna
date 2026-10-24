using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationModelRegistryIntakeReadinessTests
{
    private static ModelVersionTechnicalPreflightResult Technical(
        string family = "XGBOOST", string? dataset = "first-party-v1") =>
        new(
            AllocationModelVersionTechnicalPreflightService.ContractVersion,
            family, Guid.Parse("04033333-4444-4555-8666-777777777777"),
            Guid.Parse("04033333-4444-4555-8666-777777777777"),
            Guid.Parse("05033333-4444-4555-8666-777777777777"),
            new string('b', 64),
            HennaXGBoostOfflineLearner.ModelVersion,
            HennaXGBoostOfflineLearner.ArtifactFormat,
            new string('a', 64), dataset!,
            "source-ref", HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion,
            HennaXGBoostRuntimeContract.RuntimeContractVersion,
            AllocationModelVersionTechnicalPreflightService.XgboostStatus,
            true, true, false, false, false, false, false, false);

    [Fact]
    public void StableDigestIsBoundToExactTechnicalLineageAndNeverAdmits()
    {
        var selected = Technical();
        var a = AllocationModelRegistryIntakeReadinessService.Inspect(selected);
        var replay = AllocationModelRegistryIntakeReadinessService.Inspect(selected);
        Assert.Equal(a.ManifestSha256, replay.ManifestSha256);
        Assert.Equal(64, a.ManifestSha256.Length);
        Assert.False(a.RegistryRecordCreated);
        Assert.False(a.RegistrationAllowed);
        Assert.False(a.DatasetAdmitted);
        Assert.False(a.Approved);
        Assert.False(a.CandidateCreated);
        Assert.False(a.ProductionCompatible);
        Assert.False(a.RuntimeApplied);
        Assert.Equal(7, a.Requirements.Count);
        Assert.All(a.Requirements, gate =>
            Assert.Equal(AllocationModelRegistryIntakeReadinessService.Unverified,
                gate.Verification));
        Assert.NotEqual(a.ManifestSha256,
            AllocationModelRegistryIntakeReadinessService.Inspect(
                selected with { EvaluationFingerprint = new string('c', 64) }).ManifestSha256);
        Assert.NotEqual(a.ManifestSha256,
            AllocationModelRegistryIntakeReadinessService.Inspect(
                selected with { DatasetVersion = "other" }).ManifestSha256);
        Assert.NotEqual(a.ManifestSha256,
            AllocationModelRegistryIntakeReadinessService.Inspect(
                selected with { SourceInstructionReference = "changed" }).ManifestSha256);
    }

    [Fact]
    public void FailClosedOnFakeApprovalOrUnrecognizedRuntimeIdentity()
    {
        var item = Technical();
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { RegistrationEnabled = true }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { ProductionRuntimeCompatible = true }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { ArtifactHashVerified = false }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { EvaluationRecordLinked = false }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { TechnicalStatus = "PASSED" }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { ExistingExecutionFoundationVersion = "invented-api" }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { ModelVersion = "other" }));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                item with { Family = "CUSTOM" }));
    }

    [Fact]
    public void EbmChallengerMustNotGainAnyProductionAdapter()
    {
        var x = Technical();
        var research = x with {
            Family = "EBM",
            ModelVersion = "henna-ebm-v1-offline",
            ArtifactFormat = "henna-ebm-portable-json-v1",
            EvaluationProtocolVersion = HennaEbmBenchmarkEvaluator.ProtocolVersion,
            ExistingExecutionFoundationVersion = null,
            TechnicalStatus = AllocationModelVersionTechnicalPreflightService.EbmStatus
        };
        var report = AllocationModelRegistryIntakeReadinessService.Inspect(research);
        Assert.Null(report.ExistingExecutionFoundationVersion);
        Assert.False(report.RegistrationAllowed);
        Assert.Throws<ArgumentException>(() =>
            AllocationModelRegistryIntakeReadinessService.Inspect(
                research with { ExistingExecutionFoundationVersion = "invented" }));
    }
}
