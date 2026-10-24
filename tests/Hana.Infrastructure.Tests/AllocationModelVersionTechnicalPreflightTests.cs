using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationModelVersionTechnicalPreflightTests
{
    private static readonly DateTimeOffset Cutoff =
        new(2026, 10, 8, 12, 0, 0, TimeSpan.Zero);
    private static readonly string Digest = new('a', 64);

    private static ResearchModelArtifactDossier Dossier(
        string family, Guid runId, Guid artifactId, Guid evaluationId,
        string model, string format, string protocol) =>
        new(
            AllocationModelArtifactDossierService.ContractVersion,
            family, artifactId, runId, model, format, Digest, "first-party-dataset",
            Cutoff, true,
            [new(evaluationId, protocol, Digest, "first-party-dataset",
                "funding-lineage", Cutoff, Cutoff)],
            AllocationModelArtifactDossierService.EvidenceStatus,
            false, false, false, false);

    [Fact]
    public void XgboostSelectionMatchesOnlyExistingRawPredictionFoundation()
    {
        var run = Guid.NewGuid();
        var eval = Guid.NewGuid();
        var dossier = Dossier("XGBOOST", run, run, eval,
            HennaXGBoostOfflineLearner.ModelVersion,
            HennaXGBoostOfflineLearner.ArtifactFormat,
            HennaXGBoostShadowBenchmarkEvaluator.ProtocolVersion);
        var found = AllocationModelVersionTechnicalPreflightService.Inspect(dossier, eval);
        Assert.Equal(AllocationModelVersionTechnicalPreflightService.XgboostStatus,
            found.TechnicalStatus);
        Assert.Equal(HennaXGBoostRuntimeContract.RuntimeContractVersion,
            found.ExistingExecutionFoundationVersion);
        Assert.True(found.ArtifactAndEvaluationAttested);
        Assert.False(found.ProductionRuntimeCompatible);
        Assert.False(found.RegistrationEnabled);
        Assert.False(found.DatasetAdmitted);
        Assert.False(found.ModelApproved);
        Assert.False(found.CandidateCreated);
        Assert.False(found.RuntimeApplied);
        Assert.Equal(eval, found.EvaluationId);
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(dossier, Guid.NewGuid()));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(
                dossier with { ArtifactId = Guid.NewGuid() }, eval));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(
                dossier with { Approved = true }, eval));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(
                dossier with { Evaluations =
                    [dossier.Evaluations[0] with { ProtocolVersion = "future" }] }, eval));
    }

    [Fact]
    public void EbmRemainsOfflineWithoutAnyExecutionFoundation()
    {
        var run = Guid.NewGuid();
        var artifact = Guid.NewGuid();
        var eval = Guid.NewGuid();
        var dossier = Dossier("EBM", run, artifact, eval,
            HennaEbmPortableArtifactVerifier.ModelVersion,
            HennaEbmPortableArtifactVerifier.ArtifactFormat,
            HennaEbmBenchmarkEvaluator.ProtocolVersion);
        var found = AllocationModelVersionTechnicalPreflightService.Inspect(dossier, eval);
        Assert.Equal(AllocationModelVersionTechnicalPreflightService.EbmStatus, found.TechnicalStatus);
        Assert.Null(found.ExistingExecutionFoundationVersion);
        Assert.False(found.ProductionRuntimeCompatible);
        Assert.False(found.RegistrationEnabled);
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(
                dossier with { ModelVersion = "unsupported" }, eval));
        Assert.Throws<ArgumentException>(() =>
            AllocationModelVersionTechnicalPreflightService.Inspect(
                dossier with { ArtifactVerified = false }, eval));
    }
}
