using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class ReviewedNeedSeverityScaleV1Tests
{
    [Theory]
    [InlineData(ReviewedNeedSeverityLevel.NoUnmetEssentialNeed, 0)]
    [InlineData(ReviewedNeedSeverityLevel.Low, .25)]
    [InlineData(ReviewedNeedSeverityLevel.Moderate, .50)]
    [InlineData(ReviewedNeedSeverityLevel.High, .75)]
    [InlineData(ReviewedNeedSeverityLevel.Critical, 1)]
    public void OnlyFiveApprovedHumanLevelsHaveFixedScaleValues(
        ReviewedNeedSeverityLevel level, double value)
    {
        var selected = new ReviewedNeedSeverityScaleJudgment(
            NeedSeverityEvidenceDisposition.SufficientAndConsistent, level);
        Assert.Equal((decimal)value, selected.DisplayScore);
        Assert.False(selected.Abstained);
        Assert.Equal("HENNA-NEED-SEVERITY-FIVE-LEVEL-SCALE-v1",
            ReviewedNeedSeverityScaleJudgment.ScaleVersion);
    }

    [Theory]
    [InlineData(NeedSeverityEvidenceDisposition.Insufficient)]
    [InlineData(NeedSeverityEvidenceDisposition.Conflicting)]
    public void AbstentionIsNullNeverAZero(NeedSeverityEvidenceDisposition disposition)
    {
        var abstained = new ReviewedNeedSeverityScaleJudgment(disposition, null);
        Assert.True(abstained.Abstained);
        Assert.Null(abstained.DisplayScore);
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityScaleJudgment(
                disposition, ReviewedNeedSeverityLevel.NoUnmetEssentialNeed));
    }

    [Fact]
    public void InvalidScaleOrMissingSelectionFailsClosed()
    {
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityScaleJudgment(
                NeedSeverityEvidenceDisposition.SufficientAndConsistent, null));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityScaleJudgment(
                NeedSeverityEvidenceDisposition.SufficientAndConsistent,
                (ReviewedNeedSeverityLevel)5));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityScaleJudgment(
                (NeedSeverityEvidenceDisposition)0,
                ReviewedNeedSeverityLevel.Low));
    }

    [Fact]
    public void EvidenceLinkRequiresHumanReviewerTimeAndRationale()
    {
        var now = new DateTimeOffset(2026, 10, 9, 10, 0, 0, TimeSpan.Zero);
        var selected = new ReviewedNeedSeverityScaleJudgment(
            NeedSeverityEvidenceDisposition.SufficientAndConsistent,
            ReviewedNeedSeverityLevel.High);
        var evidence = new ReviewedNeedSeverityEvidenceV1(
            Guid.NewGuid(), Guid.NewGuid(), now.AddDays(-1), now,
            "reviewed-pre-allocation-evidence", "Human reviewed sources", selected);
        Assert.Equal(.75m, evidence.Judgment.DisplayScore);
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityEvidenceV1(
                Guid.NewGuid(), Guid.Empty, now.AddDays(-1), now,
                "evidence", "rationale", selected));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityEvidenceV1(
                Guid.NewGuid(), Guid.NewGuid(), now.AddDays(1), now,
                "evidence", "rationale", selected));
        Assert.Throws<ArgumentException>(() =>
            new ReviewedNeedSeverityEvidenceV1(
                Guid.NewGuid(), Guid.NewGuid(), now.AddDays(-1), now,
                "evidence", "", selected));
    }
}
