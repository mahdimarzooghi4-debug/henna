using System.Security.Cryptography;
using System.Text;
using Hana.Domain.Credit;

namespace Hana.Infrastructure.CreditLearning;

public sealed record AllocationLearningAutomationPolicy(
    bool Enabled,
    Guid? AutomationAccountId,
    int? MinimumTrainingLabels,
    int? MinimumValidationLabels,
    long? PoolRial)
{
    public bool IsConfigured =>
        Enabled &&
        AutomationAccountId is { } actor && actor != Guid.Empty &&
        MinimumTrainingLabels is { } training &&
            training >= 30 &&
        MinimumValidationLabels is { } validation &&
            validation >= 10 &&
        PoolRial is { } pool && pool > 0;

    public IReadOnlyList<string> MissingRequirements()
    {
        var missing = new List<string>();
        if (!Enabled) missing.Add("ENABLED");
        if (AutomationAccountId is not { } actor || actor == Guid.Empty)
            missing.Add("AUTOMATION_ACCOUNT_ID");
        if (MinimumTrainingLabels is not { } training || training < 30)
            missing.Add("MINIMUM_TRAINING_LABELS");
        if (MinimumValidationLabels is not { } validation || validation < 10)
            missing.Add("MINIMUM_VALIDATION_LABELS");
        if (PoolRial is not { } pool || pool <= 0)
            missing.Add("POOL_RIAL");
        return missing.AsReadOnly();
    }
}

public static class AllocationLearningAutomationIdentity
{
    public static Guid RequestId(
        AllocationLearningAutomationCohort cohort,
        long poolRial)
    {
        ArgumentNullException.ThrowIfNull(cohort);
        if (poolRial <= 0)
            throw new ArgumentOutOfRangeException(nameof(poolRial));
        if (cohort.LabelIds.Count == 0 ||
            cohort.LabelIds.Any(x => x == Guid.Empty) ||
            cohort.LabelIds.Distinct().Count() != cohort.LabelIds.Count)
            throw new ArgumentException("A coherent label cohort is required.");

        var text = new StringBuilder(
            ExperimentalAllocationWeightLearner.ModelVersion)
            .Append('|').Append(AllocationWeightProfile.Baseline.Version)
            .Append('|').Append(cohort.DatasetVersion)
            .Append('|').Append(cohort.SourceInstructionReference)
            .Append('|').Append(cohort.RubricVersion)
            .Append('|').Append(poolRial);
        foreach (var id in cohort.LabelIds.OrderBy(x => x))
            text.Append('|').Append(id);

        var hash = SHA256.HashData(
            Encoding.UTF8.GetBytes(text.ToString()));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        // RFC 4122 variant + version 4 shape keeps the request identity
        // compatible with existing UUID validation while remaining deterministic.
        bytes[7] = (byte)((bytes[7] & 0x0f) | 0x40);
        bytes[8] = (byte)((bytes[8] & 0x3f) | 0x80);
        return new Guid(bytes);
    }
}
