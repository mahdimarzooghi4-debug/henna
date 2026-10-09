namespace Hana.Domain.Credit;

/// <summary>
/// Approved numerical scale of a human review, NOT a complete positive
/// rubric or authorization to create training labels.
/// </summary>
public enum ReviewedNeedSeverityLevel
{
    NoUnmetEssentialNeed = 0, Low = 1, Moderate = 2, High = 3, Critical = 4
}
public enum NeedSeverityEvidenceDisposition
{
    SufficientAndConsistent = 1, Insufficient = 2, Conflicting = 3
}

/// <summary>
/// The value is meaningful only as a provisional human-selected scale level.
/// Evidence criteria and a complete quantitative rubric remain unapproved.
/// </summary>
public sealed record ReviewedNeedSeverityScaleJudgment
{
    public const string ScaleVersion = "HENNA-NEED-SEVERITY-FIVE-LEVEL-SCALE-v1";
    public NeedSeverityEvidenceDisposition EvidenceDisposition { get; }
    public ReviewedNeedSeverityLevel? Level { get; }
    public decimal? DisplayScore => Level is { } level ? (int)level * .25m : null;
    public bool Abstained => Level is null;

    public ReviewedNeedSeverityScaleJudgment(
        NeedSeverityEvidenceDisposition disposition,
        ReviewedNeedSeverityLevel? level)
    {
        if (!Enum.IsDefined(disposition) ||
            (disposition == NeedSeverityEvidenceDisposition.SufficientAndConsistent &&
                (level is null || !Enum.IsDefined(level.Value))) ||
            (disposition != NeedSeverityEvidenceDisposition.SufficientAndConsistent &&
                level is not null))
            throw new ArgumentException(
                "Five-level human review requires a valid selected level; uncertain/conflicting evidence must abstain.");
        EvidenceDisposition = disposition;
        Level = level;
    }
}

/// <summary>
/// Explicitly reviewed pre-allocation evidence link. This value object
/// does NOT assert the authenticity of referenced evidence or admit a label.
/// </summary>
public sealed record ReviewedNeedSeverityEvidenceV1
{
    public Guid SevenFactorReviewId { get; }
    public Guid ReviewerAccountId { get; }
    public DateTimeOffset EvidenceObservedAtUtc { get; }
    public DateTimeOffset ReviewedAtUtc { get; }
    public string EvidenceReference { get; }
    public string Rationale { get; }
    public ReviewedNeedSeverityScaleJudgment Judgment { get; }

    public ReviewedNeedSeverityEvidenceV1(
        Guid sevenFactorReviewId, Guid reviewerAccountId,
        DateTimeOffset evidenceObservedAtUtc, DateTimeOffset reviewedAtUtc,
        string evidenceReference, string rationale,
        ReviewedNeedSeverityScaleJudgment judgment)
    {
        ArgumentNullException.ThrowIfNull(judgment);
        if (sevenFactorReviewId == Guid.Empty || reviewerAccountId == Guid.Empty ||
            evidenceObservedAtUtc.Offset != TimeSpan.Zero ||
            reviewedAtUtc.Offset != TimeSpan.Zero ||
            evidenceObservedAtUtc > reviewedAtUtc ||
            string.IsNullOrWhiteSpace(evidenceReference) ||
            evidenceReference.Length > 240 ||
            string.IsNullOrWhiteSpace(rationale) || rationale.Length > 2000)
            throw new ArgumentException("Provisional human review requires versioned evidence, UTC time, reviewer and rationale.");
        SevenFactorReviewId = sevenFactorReviewId;
        ReviewerAccountId = reviewerAccountId;
        EvidenceObservedAtUtc = evidenceObservedAtUtc;
        ReviewedAtUtc = reviewedAtUtc;
        EvidenceReference = evidenceReference.Trim();
        Rationale = rationale.Trim();
        Judgment = judgment;
    }
}
