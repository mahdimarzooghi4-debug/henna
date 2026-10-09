using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class ReviewedNeedSeverityQualitativeRubricV1Tests
{
    [Theory]
    [InlineData(ReviewedNeedSeverityLevel.NoUnmetEssentialNeed,
        ReviewedNeedSeverityQualitativeBasis.NoVerifiedUnmetEssentialNeed, 0)]
    [InlineData(ReviewedNeedSeverityLevel.Low,
        ReviewedNeedSeverityQualitativeBasis.LimitedNeedWithoutSeriousImminentRisk, .25)]
    [InlineData(ReviewedNeedSeverityLevel.Moderate,
        ReviewedNeedSeverityQualitativeBasis.DemonstrableDisruptionToEssentialNeeds, .50)]
    [InlineData(ReviewedNeedSeverityLevel.High,
        ReviewedNeedSeverityQualitativeBasis.SeriousEssentialNeedConsequenceInNearTerm, .75)]
    [InlineData(ReviewedNeedSeverityLevel.Critical,
        ReviewedNeedSeverityQualitativeBasis.ImmediateThreatToHealthSafetyOrVitalNeeds, 1)]
    public void ApprovedHumanLevelHasExactlyItsOwnQualitativeCriterion(
        ReviewedNeedSeverityLevel level,
        ReviewedNeedSeverityQualitativeBasis basis, double score)
    {
        var rubric = new ReviewedNeedSeverityQualitativeRubricV1(
            new ReviewedNeedSeverityScaleJudgment(
                NeedSeverityEvidenceDisposition.SufficientAndConsistent, level),
            basis);
        Assert.Equal((decimal)score, rubric.Judgment.DisplayScore);
        Assert.Equal(basis, rubric.HumanSelectedBasis);
        Assert.Equal("HENNA-NEED-SEVERITY-QUALITATIVE-CRITERIA-v1",
            ReviewedNeedSeverityQualitativeRubricV1.Version);
    }

    [Theory]
    [InlineData(NeedSeverityEvidenceDisposition.Insufficient)]
    [InlineData(NeedSeverityEvidenceDisposition.Conflicting)]
    public void UnverifiableEvidenceAlwaysAbstains(
        NeedSeverityEvidenceDisposition state)
    {
        var judgement = new ReviewedNeedSeverityScaleJudgment(state, null);
        var rubric = new ReviewedNeedSeverityQualitativeRubricV1(judgement, null);
        Assert.Null(rubric.Judgment.DisplayScore);
        Assert.Null(rubric.HumanSelectedBasis);
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityQualitativeRubricV1(
                judgement, ReviewedNeedSeverityQualitativeBasis.NoVerifiedUnmetEssentialNeed));
    }

    [Fact]
    public void WrongCriterionAndMissingBasisCannotProduceAValidReview()
    {
        var high = new ReviewedNeedSeverityScaleJudgment(
            NeedSeverityEvidenceDisposition.SufficientAndConsistent,
            ReviewedNeedSeverityLevel.High);
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityQualitativeRubricV1(high, null));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityQualitativeRubricV1(
                high, ReviewedNeedSeverityQualitativeBasis.ImmediateThreatToHealthSafetyOrVitalNeeds));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityQualitativeRubricV1(
                high, (ReviewedNeedSeverityQualitativeBasis)77));
    }
}
