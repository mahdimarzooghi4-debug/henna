namespace Hana.Domain.Credit;

/// <summary>
/// A reviewed v1.1 household input tied to a single immutable geography dataset
/// and its urban/rural MPI normalization range. No location is inferred.
/// </summary>
public sealed record SevenFactorGeographyScenarioCase
{
    public HouseholdSevenFactorAssessmentV11 Assessment { get; }
    public string GeographyDatasetVersion { get; }
    public decimal Mpi { get; }
    public decimal MinimumMpi { get; }
    public decimal MaximumMpi { get; }
    public bool IsProvincialCapital { get; }

    public SevenFactorGeographyScenarioCase(
        HouseholdSevenFactorAssessmentV11 assessment,
        string geographyDatasetVersion, decimal mpi,
        decimal minimumMpi, decimal maximumMpi, bool isProvincialCapital)
    {
        ArgumentNullException.ThrowIfNull(assessment);
        if (string.IsNullOrWhiteSpace(geographyDatasetVersion) ||
            geographyDatasetVersion.Length > 120)
            throw new ArgumentException("Exact reviewed geography dataset version is required.");
        // This also validates the MPI range. The attested source must match
        // the existing formula exactly; otherwise we must not silently repair G.
        var approvedG = NeedsBasedAllocationV1.CalculateGeographicFactor(
            mpi, minimumMpi, maximumMpi, isProvincialCapital);
        if (approvedG != assessment.GeographicFactor)
            throw new ArgumentException(
                "Reviewed source geographic factor does not match the versioned MPI inputs.");
        Assessment = assessment;
        GeographyDatasetVersion = geographyDatasetVersion.Trim();
        Mpi = mpi;
        MinimumMpi = minimumMpi;
        MaximumMpi = maximumMpi;
        IsProvincialCapital = isProvincialCapital;
    }
}

public sealed record SevenFactorScenarioComparisonRow(
    Guid HouseholdKey,
    Guid SnapshotId,
    long BaselineAmountRial,
    long CandidateAmountRial,
    decimal BaselineHouseholdFactor,
    decimal CandidateHouseholdFactor,
    decimal BaselineGeographicFactor,
    decimal CandidateGeographicFactor)
{
    public long DifferenceRial => CandidateAmountRial - BaselineAmountRial;
}

public sealed record SevenFactorScenarioComparisonResult(
    string BaselineFormulaVersion,
    string CandidateWeightVersion,
    string BaselineGeographyDatasetVersion,
    string CandidateGeographyVersion,
    string SourceInstructionReference,
    long PoolRial,
    long BaselineUnallocatedRial,
    long CandidateUnallocatedRial,
    IReadOnlyList<SevenFactorScenarioComparisonRow> Rows);

/// <summary>
/// Strictly offline read-only comparison. It can evaluate separately proposed
/// weights and research geography parameters against the APPROVED v1.1 starting
/// profile. It NEVER derives proposed values, learns from labels, accepts
/// evidence authenticity, posts grants or activates an AI candidate.
/// </summary>
public static class SevenFactorScenarioComparison
{
    public static SevenFactorScenarioComparisonResult ComparePool(
        long poolRial,
        IReadOnlyList<SevenFactorGeographyScenarioCase> cases,
        SevenFactorCoefficientDraft candidateWeights,
        string sourceInstructionReference,
        GeographyParameterResearchDraft? proposedGeography = null)
    {
        ArgumentNullException.ThrowIfNull(cases);
        ArgumentNullException.ThrowIfNull(candidateWeights);
        if (poolRial <= 0L)
            throw new ArgumentOutOfRangeException(nameof(poolRial));
        if (string.IsNullOrWhiteSpace(sourceInstructionReference) ||
            sourceInstructionReference.Length > 120)
            throw new ArgumentException("Exact funding instruction is required.");
        if (candidateWeights.Version == NeedsBasedAllocationV11.FormulaVersion ||
            candidateWeights.Version == NeedsBasedAllocationV11.ScoringVersion)
            throw new ArgumentException("Candidate weights require a separate version.");

        var rows = cases.ToArray();
        if (rows.Length is < 1 or > 500 || rows.Any(x => x is null))
            throw new ArgumentException("A bounded complete scenario cohort is required.");
        if (rows.Select(x => x.Assessment.HouseholdKey).Distinct().Count() != rows.Length ||
            rows.Select(x => x.Assessment.SnapshotId).Distinct().Count() != rows.Length)
            throw new ArgumentException("Cohort snapshots and households must be distinct.");
        if (rows.Select(x => x.GeographyDatasetVersion).Distinct().Count() != 1)
            throw new ArgumentException("Mixed geography datasets cannot be compared.");

        var datasetVersion = rows[0].GeographyDatasetVersion;
        if (proposedGeography is not null &&
            proposedGeography.GeographyDatasetVersion != datasetVersion)
            throw new ArgumentException(
                "A geography candidate must use the exact frozen source MPI dataset.");

        var baselineH = rows.Select(x =>
            NeedsBasedAllocationV11.CalculateHouseholdFactor(x.Assessment)).ToArray();
        var baselineG = rows.Select(x => x.Assessment.GeographicFactor).ToArray();
        var candidateH = rows.Select(x =>
            CandidateFactor(x.Assessment, candidateWeights)).ToArray();
        var candidateG = rows.Select(x =>
            proposedGeography is null ? x.Assessment.GeographicFactor :
                ProposedGeographicFactor(x, proposedGeography)).ToArray();

        var baselineWeight = rows.Select((x, i) =>
            baselineH[i] * baselineG[i]).ToArray();
        var proposedWeight = rows.Select((x, i) =>
            candidateH[i] * candidateG[i]).ToArray();
        var baselineAmounts = Allocate(poolRial, baselineWeight);
        var candidateAmounts = Allocate(poolRial, proposedWeight);
        var results = rows.Select((x, i) => new SevenFactorScenarioComparisonRow(
            x.Assessment.HouseholdKey, x.Assessment.SnapshotId,
            baselineAmounts[i], candidateAmounts[i],
            baselineH[i], candidateH[i], baselineG[i], candidateG[i])).ToArray();

        long totalBaseline = 0L, totalCandidate = 0L;
        foreach (var row in results)
        {
            totalBaseline = checked(totalBaseline + row.BaselineAmountRial);
            totalCandidate = checked(totalCandidate + row.CandidateAmountRial);
        }
        return new(
            NeedsBasedAllocationV11.FormulaVersion,
            candidateWeights.Version, datasetVersion,
            proposedGeography?.Version ?? datasetVersion,
            sourceInstructionReference.Trim(), poolRial,
            checked(poolRial - totalBaseline),
            checked(poolRial - totalCandidate),
            Array.AsReadOnly(results));
    }

    private static decimal CandidateFactor(
        HouseholdSevenFactorAssessmentV11 assessment,
        SevenFactorCoefficientDraft p)
    {
        var s = assessment.SixScores;
        var weighted = p.Health * s.Health + p.Hardship * s.EconomicHardship +
            p.Age * s.AgeAndDependency + p.Size * s.HouseholdSize +
            p.Care * s.CareAndSupport + p.Education * s.Education +
            p.Housing * NeedsBasedAllocationV11.ScoreHousing(assessment.Housing.Tenure);
        return 1m + .5m * weighted / 3m;
    }

    private static decimal ProposedGeographicFactor(
        SevenFactorGeographyScenarioCase x,
        GeographyParameterResearchDraft p)
    {
        var normalized = p.MinimumFactor +
            (p.MaximumFactor - p.MinimumFactor) *
            (x.Mpi - x.MinimumMpi) / (x.MaximumMpi - x.MinimumMpi);
        return x.IsProvincialCapital
            ? normalized * p.ProvincialCapitalAdjustment
            : normalized;
    }

    private static long[] Allocate(long poolRial, decimal[] weights)
    {
        if (weights.Length == 0 || weights.Any(x => x <= 0m))
            throw new ArgumentException("Strictly positive allocation weights are required.");
        var denominator = weights.Sum();
        var amounts = weights.Select(w =>
            checked((long)decimal.Floor(poolRial * w / denominator))).ToArray();
        if (amounts.Aggregate(0L, (sum, amount) => checked(sum + amount)) > poolRial)
            throw new InvalidOperationException("Scenario cannot exceed its source pool.");
        return amounts;
    }
}
