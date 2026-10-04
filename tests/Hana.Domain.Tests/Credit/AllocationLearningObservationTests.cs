using Hana.Domain.Credit;
using Xunit;

namespace Hana.Domain.Tests.Credit;

public sealed class AllocationLearningObservationTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void UnknownUsageIsPreservedWhenAccessBarrierIsObserved()
    {
        var observation = new AllocationLearningObservation(Guid.NewGuid(), Guid.NewGuid(),
            Start, Start.AddDays(1), null, null, null, null, true,
            AllocationOutcomeEvidence.HouseholdReported);
        Assert.Null(observation.CreditUsedRial);
        Assert.Null(observation.EssentialNeedsCoverage);
        Assert.Equal(true, observation.AccessBarrier);
    }

    [Fact]
    public void MissingMeasurementsAreRejected()
    {
        Assert.Throws<ArgumentException>(() => new AllocationLearningObservation(
            Guid.NewGuid(), Guid.NewGuid(), Start, Start.AddDays(1),
            null, null, null, null, null, AllocationOutcomeEvidence.Administrative));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    public void CoverageMustBeBetweenZeroAndOne(int coverage)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new AllocationLearningObservation(
            Guid.NewGuid(), Guid.NewGuid(), Start, Start.AddDays(1),
            null, coverage, null, null, null, AllocationOutcomeEvidence.HumanReviewed));
    }
}
