namespace Hana.Domain.Credit;

/// <summary>
/// Reviewed version-1.1 input, kept separate from the historical six-factor
/// HouseholdNeedScores. The hardship reference documents that rent/housing was
/// excluded from the approved economic-hardship input to avoid double counting.
/// References are mandatory but do not by themselves prove evidence authenticity.
/// </summary>
public sealed class HouseholdSevenFactorAssessmentV11
{
    public Guid HouseholdKey { get; }
    public Guid SnapshotId { get; }
    public HouseholdNeedScores SixScores { get; }
    public HouseholdHousingTenureEvidence Housing { get; }
    public string NonHousingHardshipEvidenceReference { get; }
    public decimal GeographicFactor { get; }

    public HouseholdSevenFactorAssessmentV11(
        Guid householdKey, Guid snapshotId, HouseholdNeedScores sixScores,
        HouseholdHousingTenureEvidence housing,
        string nonHousingHardshipEvidenceReference, decimal geographicFactor)
    {
        if (householdKey == Guid.Empty || snapshotId == Guid.Empty ||
            sixScores is null || housing is null ||
            housing.SnapshotId != snapshotId ||
            string.IsNullOrWhiteSpace(nonHousingHardshipEvidenceReference) ||
            nonHousingHardshipEvidenceReference.Length > 240 ||
            geographicFactor <= 0m)
            throw new ArgumentException(
                "Seven-factor inputs require matching reviewed housing and non-housing hardship provenance, plus positive geography.");
        HouseholdKey = householdKey;
        SnapshotId = snapshotId;
        SixScores = sixScores;
        Housing = housing;
        NonHousingHardshipEvidenceReference = nonHousingHardshipEvidenceReference.Trim();
        GeographicFactor = geographicFactor;
    }
}

public sealed record SevenFactorPoolPreviewRowV11(
    Guid HouseholdKey, Guid SnapshotId, int HousingScore,
    decimal HouseholdFactor, decimal GeographicFactor, long AllocatedRial);

public sealed record SevenFactorPoolPreviewV11(
    string FormulaVersion, string ScoringVersion, long PoolRial,
    long UnallocatedRial, IReadOnlyList<SevenFactorPoolPreviewRowV11> Rows);

/// <summary>
/// Product-approved initial seven-factor formula, isolated from the six-factor
/// Commerce runtime. Deterministic Domain calculation and research preview only.
/// No provider, wallet, grant, activation, AI fit or migration path.
/// </summary>
public static class NeedsBasedAllocationV11
{
    public const string FormulaVersion = "HANA-NEEDS-BASED-ALLOCATION-v1.1";
    public const string ScoringVersion = "HANA-HOUSEHOLD-NEED-SCORING-v1.1";

    public const decimal HealthWeight = .30m;
    public const decimal NonHousingHardshipWeight = .20m;
    public const decimal AgeAndDependencyWeight = .15m;
    public const decimal HouseholdSizeWeight = .10m;
    public const decimal CareAndSupportWeight = .10m;
    public const decimal EducationWeight = .05m;
    public const decimal HousingTenureWeight = .10m;

    public static int ScoreHousing(HouseholdHousingTenure tenure) => tenure switch
    {
        HouseholdHousingTenure.Owner => 0,
        HouseholdHousingTenure.Tenant => 2,
        _ => throw new ArgumentOutOfRangeException(nameof(tenure))
    };

    public static decimal CalculateHouseholdFactor(HouseholdSevenFactorAssessmentV11 assessment)
    {
        ArgumentNullException.ThrowIfNull(assessment);
        var s = assessment.SixScores;
        var score = HealthWeight * s.Health +
            NonHousingHardshipWeight * s.EconomicHardship +
            AgeAndDependencyWeight * s.AgeAndDependency +
            HouseholdSizeWeight * s.HouseholdSize +
            CareAndSupportWeight * s.CareAndSupport +
            EducationWeight * s.Education +
            HousingTenureWeight * ScoreHousing(assessment.Housing.Tenure);
        return 1m + .5m * score / 3m;
    }

    /// <summary>
    /// Source-authorized pool formula, floor-to-rial and explicit remainder.
    /// This is a read-only preview: it cannot post real credit or promote a model.
    /// The geographic multiplier is supplied as an independently reviewed input,
    /// not learned or replaced by the household coefficients in this slice.
    /// </summary>
    public static SevenFactorPoolPreviewV11 PreviewPool(
        long poolRial, IReadOnlyList<HouseholdSevenFactorAssessmentV11> assessments)
    {
        ArgumentNullException.ThrowIfNull(assessments);
        if (poolRial <= 0)
            throw new ArgumentOutOfRangeException(nameof(poolRial));
        var rows = assessments.ToArray();
        if (rows.Length is < 1 or > 500 ||
            rows.Any(x => x is null || x.HouseholdKey == Guid.Empty ||
                          x.SnapshotId == Guid.Empty || x.GeographicFactor <= 0m) ||
            rows.Select(x => x.HouseholdKey).Distinct().Count() != rows.Length ||
            rows.Select(x => x.SnapshotId).Distinct().Count() != rows.Length)
            throw new ArgumentException(
                "Pool preview requires distinct, reviewed seven-factor assessments.");

        var factors = rows.Select(CalculateHouseholdFactor).ToArray();
        var weights = rows.Select((x, i) => factors[i] * x.GeographicFactor).ToArray();
        var denominator = weights.Sum();
        if (denominator <= 0m)
            throw new ArgumentException("Valid positive pool weights are required.");

        long assigned = 0;
        var grants = new List<SevenFactorPoolPreviewRowV11>(rows.Length);
        for (var i = 0; i < rows.Length; i++)
        {
            var amount = checked((long)decimal.Floor(poolRial * weights[i] / denominator));
            assigned = checked(assigned + amount);
            grants.Add(new(rows[i].HouseholdKey, rows[i].SnapshotId,
                ScoreHousing(rows[i].Housing.Tenure), factors[i],
                rows[i].GeographicFactor, amount));
        }
        if (assigned > poolRial)
            throw new InvalidOperationException("Preview exceeds the source pool.");
        return new(FormulaVersion, ScoringVersion, poolRial,
            checked(poolRial - assigned), grants.AsReadOnly());
    }
}
