namespace Hana.Domain.Credit;

/// <summary>
/// Product-approved HUMAN qualitative anchors. Values only pair an explicitly
/// chosen level to the corresponding reviewed reason; they never infer a level
/// from narrative text, household data, outcomes, or a model prediction.
/// </summary>
public enum ReviewedNeedSeverityQualitativeBasis
{
    NoVerifiedUnmetEssentialNeed = 0,
    LimitedNeedWithoutSeriousImminentRisk = 1,
    DemonstrableDisruptionToEssentialNeeds = 2,
    SeriousEssentialNeedConsequenceInNearTerm = 3,
    ImmediateThreatToHealthSafetyOrVitalNeeds = 4
}

/// <summary>
/// Independent qualitative criteria for the approved five-level human scale.
/// Not proof that a cited document is genuine, nor a complete numeric-label
/// admission rubric; unknown/contradictory data still require abstention.
/// </summary>
public sealed record ReviewedNeedSeverityQualitativeRubricV1
{
    public const string Version = "HENNA-NEED-SEVERITY-QUALITATIVE-CRITERIA-v1";
    public ReviewedNeedSeverityScaleJudgment Judgment { get; }
    public ReviewedNeedSeverityQualitativeBasis? HumanSelectedBasis { get; }

    public ReviewedNeedSeverityQualitativeRubricV1(
        ReviewedNeedSeverityScaleJudgment judgment,
        ReviewedNeedSeverityQualitativeBasis? humanSelectedBasis)
    {
        ArgumentNullException.ThrowIfNull(judgment);
        if (judgment.Abstained)
        {
            if (humanSelectedBasis is not null)
                throw new ArgumentException("Abstention must not carry a severity criterion or score.");
        }
        else if (humanSelectedBasis is null ||
                 !Enum.IsDefined(humanSelectedBasis.Value) ||
                 (int)humanSelectedBasis.Value != (int)judgment.Level!.Value)
            throw new ArgumentException(
                "Human-selected severity level and qualitative criterion must match exactly.");
        Judgment = judgment;
        HumanSelectedBasis = humanSelectedBasis;
    }
}
