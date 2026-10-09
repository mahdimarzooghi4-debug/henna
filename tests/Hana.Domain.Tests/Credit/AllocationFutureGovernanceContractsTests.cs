using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class AllocationFutureGovernanceContractsTests
{
    [Fact]
    public void TwoLearningTargetsRetainIndependentEvidenceIdentities()
    {
        var snapshot = Guid.NewGuid();
        var severityEvidence = Guid.NewGuid();
        var coverageEvidence = Guid.NewGuid();
        var severity = new AllocationLearningTargetEvidence(snapshot,
            severityEvidence, AllocationLearningTargetKind.ReviewedNeedSeverity);
        var coverage = new AllocationLearningTargetEvidence(snapshot,
            coverageEvidence, AllocationLearningTargetKind.EvidenceBackedEssentialNeedsCoverage);
        Assert.Equal(snapshot, severity.AllocationSnapshotId);
        Assert.Equal(snapshot, coverage.AllocationSnapshotId);
        Assert.NotEqual(severity.Kind, coverage.Kind);
        Assert.NotEqual(severity.EvidenceId, coverage.EvidenceId);
        Assert.Throws<ArgumentException>(() => new AllocationLearningTargetEvidence(
            snapshot, Guid.Empty, AllocationLearningTargetKind.ReviewedNeedSeverity));
        Assert.Throws<ArgumentException>(() => new AllocationLearningTargetEvidence(
            snapshot, coverageEvidence, (AllocationLearningTargetKind)999));
    }

    [Fact]
    public void HousingCannotBeInferredFromUnknownOrMappedToNumericWeights()
    {
        var snapshot = Guid.NewGuid();
        var owner = new HouseholdHousingTenureEvidence(snapshot,
            HouseholdHousingTenure.Owner, "reviewed-housing-source");
        var tenant = new HouseholdHousingTenureEvidence(snapshot,
            HouseholdHousingTenure.Tenant, "reviewed-housing-source");
        Assert.NotEqual(owner.Tenure, tenant.Tenure);
        Assert.Throws<ArgumentException>(() => new HouseholdHousingTenureEvidence(
            snapshot, (HouseholdHousingTenure)0, "reviewed"));
        Assert.Throws<ArgumentException>(() => new HouseholdHousingTenureEvidence(
            snapshot, HouseholdHousingTenure.Tenant, ""));
        Assert.Throws<ArgumentException>(() => new SevenFactorCoefficientDraft(
            "missing-housing-weight", .30m, .25m, .18m, .12m, .10m, .05m, 0m));
        // A complete seven-weight research draft is expressible, but it is
        // not an approved scoring mapping or an active Commerce profile.
        var draft = new SevenFactorCoefficientDraft(
            "ci-research-only", .30m, .20m, .15m, .10m, .10m, .05m, .10m);
        Assert.Equal(1m, draft.Health + draft.Hardship + draft.Age +
            draft.Size + draft.Care + draft.Education + draft.Housing);
        Assert.Throws<ArgumentException>(() => new SevenFactorCoefficientDraft(
            "invalid", .30m, .20m, .15m, .10m, .10m, .05m, -.10m));
    }

    [Fact]
    public void GeographyCandidateIsSeparateFromApprovedRuntimeAndRequiresLineage()
    {
        var draft = new GeographyParameterResearchDraft(
            "research-draft", "approved-geography-dataset-reference",
            Guid.NewGuid(), Guid.NewGuid(), .8m, 1.2m, 1.2m);
        Assert.Equal(.8m, draft.MinimumFactor);
        Assert.Equal(1.2m, draft.MaximumFactor);
        Assert.Throws<ArgumentException>(() => new GeographyParameterResearchDraft(
            "no-evaluation", "dataset", Guid.NewGuid(), Guid.Empty,
            .8m, 1.2m, 1.2m));
        Assert.Throws<ArgumentException>(() => new GeographyParameterResearchDraft(
            "invalid-order", "dataset", Guid.NewGuid(), Guid.NewGuid(),
            1.2m, .8m, 1.2m));
    }

    [Fact]
    public void FundingDualControlRequiresTwoDistinctEvidenceReferences()
    {
        var programId = Guid.NewGuid();
        var financeId = Guid.NewGuid();
        var bankId = Guid.NewGuid();
        var refs = new FundingDualEvidenceReferences(programId, financeId, bankId);
        Assert.Equal(financeId, refs.FinanceManagerApprovalId);
        Assert.Equal(bankId, refs.BankReconciliationEvidenceId);
        Assert.Throws<ArgumentException>(() => new FundingDualEvidenceReferences(
            programId, financeId, Guid.Empty));
        Assert.Throws<ArgumentException>(() => new FundingDualEvidenceReferences(
            programId, Guid.Empty, bankId));
        Assert.Throws<ArgumentException>(() => new FundingDualEvidenceReferences(
            programId, financeId, financeId));
    }
}
