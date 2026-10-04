namespace Hana.Domain.Credit;

/// <summary>Immutable coefficient snapshot for offline evaluation only.</summary>
public sealed record AllocationWeightProfile
{
    public string Version { get; }
    public decimal Health { get; }
    public decimal Hardship { get; }
    public decimal Age { get; }
    public decimal Size { get; }
    public decimal Care { get; }
    public decimal Education { get; }

    public AllocationWeightProfile(string version, decimal health, decimal hardship,
        decimal age, decimal size, decimal care, decimal education)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(version);
        var weights = new[] { health, hardship, age, size, care, education };
        if (weights.Any(w => w < 0m || w > 1m) || weights.Sum() != 1m)
            throw new ArgumentException("Weights must be nonnegative and sum to one.");
        Version = version;
        Health = health; Hardship = hardship; Age = age;
        Size = size; Care = care; Education = education;
    }

    public static AllocationWeightProfile Baseline { get; } = new(
        "henna-learning-baseline-v1", NeedsBasedAllocationV1.HealthWeight,
        NeedsBasedAllocationV1.EconomicHardshipWeight, NeedsBasedAllocationV1.AgeAndDependencyWeight,
        NeedsBasedAllocationV1.HouseholdSizeWeight, NeedsBasedAllocationV1.CareAndSupportWeight,
        NeedsBasedAllocationV1.EducationWeight);

    public decimal Factor(HouseholdNeedScores scores)
    {
        ArgumentNullException.ThrowIfNull(scores);
        return 1m + 0.5m * (Health * scores.Health + Hardship * scores.EconomicHardship +
            Age * scores.AgeAndDependency + Size * scores.HouseholdSize +
            Care * scores.CareAndSupport + Education * scores.Education) / 3m;
    }
}

/// <summary>Pseudonymous, frozen assessment; no names, addresses or diagnoses.</summary>
public sealed record AllocationLearningCase(Guid HouseholdKey, HouseholdNeedScores Scores,
    decimal GeographicFactor);

public sealed record AllocationSimulationRow(Guid HouseholdKey, decimal BaselineAmountRial,
    decimal ProposedAmountRial)
{
    public decimal ChangeRial => ProposedAmountRial - BaselineAmountRial;
}

public sealed record AllocationSimulation(string BaselineVersion, string ProposedVersion,
    string DatasetVersion, string SourceInstructionReference,
    IReadOnlyList<AllocationSimulationRow> Rows);

/// <summary>Unrounded POOL_NEEDS preview. Never posts money or activates coefficients.</summary>
public static class AllocationLearningSimulator
{
    public static AllocationSimulation ComparePool(decimal poolRial,
        IReadOnlyList<AllocationLearningCase> cases, AllocationWeightProfile baseline,
        AllocationWeightProfile proposed, string datasetVersion, string sourceInstructionReference)
    {
        ArgumentNullException.ThrowIfNull(cases);
        ArgumentNullException.ThrowIfNull(baseline);
        ArgumentNullException.ThrowIfNull(proposed);
        ArgumentException.ThrowIfNullOrWhiteSpace(datasetVersion);
        ArgumentException.ThrowIfNullOrWhiteSpace(sourceInstructionReference);
        if (poolRial <= 0m) throw new ArgumentOutOfRangeException(nameof(poolRial));
        if (baseline.Version == proposed.Version)
            throw new ArgumentException("A candidate needs a distinct version.");
        var snapshot = cases.ToArray();
        if (snapshot.Length == 0 || snapshot.Any(c => c is null || c.HouseholdKey == Guid.Empty ||
            c.Scores is null || c.GeographicFactor <= 0m) ||
            snapshot.Select(c => c.HouseholdKey).Distinct().Count() != snapshot.Length)
            throw new ArgumentException("Complete unique cases with positive geography are required.");
        var current = snapshot.Select(c => c.GeographicFactor * baseline.Factor(c.Scores)).ToArray();
        var candidate = snapshot.Select(c => c.GeographicFactor * proposed.Factor(c.Scores)).ToArray();
        var currentTotal = current.Sum();
        var candidateTotal = candidate.Sum();
        var rows = snapshot.Select((c, i) => new AllocationSimulationRow(c.HouseholdKey,
            poolRial * current[i] / currentTotal, poolRial * candidate[i] / candidateTotal)).ToArray();
        return new(baseline.Version, proposed.Version, datasetVersion,
            sourceInstructionReference, Array.AsReadOnly(rows));
    }
}
