namespace Hana.Domain.Credit;

public sealed record HouseholdNeedAssessmentInput
{
    public HealthBurdenLevel? HealthBurden { get; init; }
    public EconomicHardshipLevel? EconomicHardship { get; init; }
    public CareSupportLevel? CareAndSupport { get; init; }
    public EducationAttainment? Education { get; init; }
    public int? HouseholdSize { get; init; }
    public HouseholdAgeComposition? AgeComposition { get; init; }
}

public enum HealthBurdenLevel
{
    NoOngoingTreatment,
    OneManageableOngoingCase,
    HighCostOrLimitingOrMultipleManageableCases,
    SevereOngoingCareOrMultipleHighBurdenCases
}

public enum EconomicHardshipLevel
{
    EssentialNeedsGenerallyMet,
    OccasionalShortfallInOneEssentialNeed,
    RecurrentShortfallOrEssentialDebt,
    MultipleEssentialNeedsUnmetOrSevereInstability
}

public enum CareSupportLevel
{
    EffectiveAdultOrPracticalSupportAvailable,
    OneResponsibleAdultWithoutDependents,
    LoneCaregiverWithOneDependentOrLimitedSupport,
    NoPracticalSupportWithMultipleDependentsOrHighCareBurden
}

public enum EducationAttainment
{
    BachelorOrHigher,
    DiplomaOrAssociate,
    BelowDiplomaWithFormalEducation,
    NoLiteracyOrFormalEducation
}

public sealed record HouseholdAgeComposition
{
    public int UnderTwo { get; }
    public int AgeTwoToFive { get; }
    public int AgeSixToSeventeen { get; }
    public int AgeEighteenToFiftyNine { get; }
    public int AgeSixtyOrOlder { get; }
    public int? SeniorsNeedingPracticalSupport { get; }

    public HouseholdAgeComposition(int underTwo, int ageTwoToFive, int ageSixToSeventeen,
        int ageEighteenToFiftyNine, int ageSixtyOrOlder, int? seniorsNeedingPracticalSupport)
    {
        UnderTwo = Count(underTwo, nameof(underTwo));
        AgeTwoToFive = Count(ageTwoToFive, nameof(ageTwoToFive));
        AgeSixToSeventeen = Count(ageSixToSeventeen, nameof(ageSixToSeventeen));
        AgeEighteenToFiftyNine = Count(ageEighteenToFiftyNine, nameof(ageEighteenToFiftyNine));
        AgeSixtyOrOlder = Count(ageSixtyOrOlder, nameof(ageSixtyOrOlder));
        if (seniorsNeedingPracticalSupport is < 0 || seniorsNeedingPracticalSupport > AgeSixtyOrOlder)
            throw new ArgumentOutOfRangeException(nameof(seniorsNeedingPracticalSupport));
        SeniorsNeedingPracticalSupport = seniorsNeedingPracticalSupport;
    }

    internal long Total => (long)UnderTwo + AgeTwoToFive + AgeSixToSeventeen +
        AgeEighteenToFiftyNine + AgeSixtyOrOlder;

    private static int Count(int value, string name) => value < 0
        ? throw new ArgumentOutOfRangeException(name, value, "Age-band counts cannot be negative.")
        : value;
}

public static class HouseholdNeedScoringV1
{
    public const string Version = "1.0";

    public static HouseholdNeedScores Map(HouseholdNeedAssessmentInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var missing = new List<string>();
        if (input.HealthBurden is null) missing.Add(nameof(input.HealthBurden));
        if (input.EconomicHardship is null) missing.Add(nameof(input.EconomicHardship));
        if (input.CareAndSupport is null) missing.Add(nameof(input.CareAndSupport));
        if (input.Education is null) missing.Add(nameof(input.Education));
        if (input.HouseholdSize is null) missing.Add(nameof(input.HouseholdSize));
        if (input.AgeComposition is null) missing.Add(nameof(input.AgeComposition));
        if (missing.Count > 0)
            throw new InvalidOperationException($"Incomplete household assessment: {string.Join(", ", missing)}.");

        var size = input.HouseholdSize!.Value;
        var ages = input.AgeComposition!;
        if (size <= 0)
            throw new ArgumentOutOfRangeException(nameof(input.HouseholdSize));
        if (ages.SeniorsNeedingPracticalSupport is null)
            throw new InvalidOperationException("Practical support need for members aged 60+ is required.");
        if (ages.Total != size)
            throw new ArgumentException("Age-band counts must account for every household member.", nameof(input.AgeComposition));

        return new HouseholdNeedScores(
            Health(input.HealthBurden!.Value),
            Hardship(input.EconomicHardship!.Value),
            Math.Min(3m, ages.UnderTwo * 1m + ages.AgeTwoToFive * 0.75m +
                ages.AgeSixToSeventeen * 0.5m + ages.SeniorsNeedingPracticalSupport.Value * 0.75m),
            Size(size),
            Care(input.CareAndSupport!.Value),
            Education(input.Education!.Value));
    }

    private static int Health(HealthBurdenLevel value) => value switch
    {
        HealthBurdenLevel.NoOngoingTreatment => 0,
        HealthBurdenLevel.OneManageableOngoingCase => 1,
        HealthBurdenLevel.HighCostOrLimitingOrMultipleManageableCases => 2,
        HealthBurdenLevel.SevereOngoingCareOrMultipleHighBurdenCases => 3,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    private static int Hardship(EconomicHardshipLevel value) => value switch
    {
        EconomicHardshipLevel.EssentialNeedsGenerallyMet => 0,
        EconomicHardshipLevel.OccasionalShortfallInOneEssentialNeed => 1,
        EconomicHardshipLevel.RecurrentShortfallOrEssentialDebt => 2,
        EconomicHardshipLevel.MultipleEssentialNeedsUnmetOrSevereInstability => 3,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    private static decimal Size(int value) => value switch
    {
        1 => 0m, 2 => 0.5m, 3 => 1m, 4 => 1.5m,
        5 => 2m, 6 => 2.5m, _ => 3m
    };

    private static int Care(CareSupportLevel value) => value switch
    {
        CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable => 0,
        CareSupportLevel.OneResponsibleAdultWithoutDependents => 1,
        CareSupportLevel.LoneCaregiverWithOneDependentOrLimitedSupport => 2,
        CareSupportLevel.NoPracticalSupportWithMultipleDependentsOrHighCareBurden => 3,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };

    private static int Education(EducationAttainment value) => value switch
    {
        EducationAttainment.BachelorOrHigher => 0,
        EducationAttainment.DiplomaOrAssociate => 1,
        EducationAttainment.BelowDiplomaWithFormalEducation => 2,
        EducationAttainment.NoLiteracyOrFormalEducation => 3,
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}
