namespace Hana.Domain.Credit;

/// <summary>
/// Quantified, versioned inputs supplied by the approved qualitative-to-score
/// mapping. Each dimension is on the inclusive 0–3 scale.
/// </summary>
public sealed record HouseholdNeedScores
{
    public int Health { get; }
    public int EconomicHardship { get; }
    public int AgeAndDependency { get; }
    public int HouseholdSize { get; }
    public int CareAndSupport { get; }
    public int Education { get; }

    public HouseholdNeedScores(
        int health,
        int economicHardship,
        int ageAndDependency,
        int householdSize,
        int careAndSupport,
        int education)
    {
        ValidateScore(health, nameof(health));
        ValidateScore(economicHardship, nameof(economicHardship));
        ValidateScore(ageAndDependency, nameof(ageAndDependency));
        ValidateScore(householdSize, nameof(householdSize));
        ValidateScore(careAndSupport, nameof(careAndSupport));
        ValidateScore(education, nameof(education));

        Health = health;
        EconomicHardship = economicHardship;
        AgeAndDependency = ageAndDependency;
        HouseholdSize = householdSize;
        CareAndSupport = careAndSupport;
        Education = education;
    }

    private static void ValidateScore(int score, string name)
    {
        if (score is < 0 or > 3)
        {
            throw new ArgumentOutOfRangeException(name, score,
                "Household need scores must be between 0 and 3.");
        }
    }
}
