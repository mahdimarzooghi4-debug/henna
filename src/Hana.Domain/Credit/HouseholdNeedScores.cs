namespace Hana.Domain.Credit;

public sealed record HouseholdNeedScores
{
    public int Health { get; }
    public int EconomicHardship { get; }
    public decimal AgeAndDependency { get; }
    public decimal HouseholdSize { get; }
    public int CareAndSupport { get; }
    public int Education { get; }

    public HouseholdNeedScores(int health, int economicHardship, decimal ageAndDependency,
        decimal householdSize, int careAndSupport, int education)
    {
        Check(health, nameof(health));
        Check(economicHardship, nameof(economicHardship));
        Check(ageAndDependency, nameof(ageAndDependency));
        Check(householdSize, nameof(householdSize));
        Check(careAndSupport, nameof(careAndSupport));
        Check(education, nameof(education));
        Health = health;
        EconomicHardship = economicHardship;
        AgeAndDependency = ageAndDependency;
        HouseholdSize = householdSize;
        CareAndSupport = careAndSupport;
        Education = education;
    }

    private static void Check(decimal score, string name)
    {
        if (score is < 0m or > 3m)
            throw new ArgumentOutOfRangeException(name, score,
                "Household need scores must be between 0 and 3.");
    }
}
