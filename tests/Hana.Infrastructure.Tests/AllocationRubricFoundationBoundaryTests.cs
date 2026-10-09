using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationRubricFoundationBoundaryTests
{
    [Theory]
    [InlineData("HENNA-AJF-v1")]
    [InlineData("HENNA-ARR-v1")]
    [InlineData(" henna-arr-v1 ")]
    [InlineData(" henna-ajf-v1 ")]
    [InlineData("HENNA-NEED-SEVERITY-FIVE-LEVEL-SCALE-v1")]
    [InlineData(" henna-need-severity-five-level-scale-v1 ")]
    public void ReviewFoundationsAreNotNumericLabelRubrics(string version)
    {
        Assert.True(AllocationRubricFoundationBoundary.IsNonLabelingFoundation(version));
        Assert.Throws<ArgumentException>(() =>
            AllocationRubricFoundationBoundary.RejectNonLabelingFoundation(version));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("synthetic-rubric-1")]
    [InlineData("HENNA-ARR-v2")]
    public void OtherIdentifiersAreNotApprovedOrDeniedByThisNarrowCheck(string? version)
    {
        Assert.False(AllocationRubricFoundationBoundary.IsNonLabelingFoundation(version));
        AllocationRubricFoundationBoundary.RejectNonLabelingFoundation(version);
    }
}
