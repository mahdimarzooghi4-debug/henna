using Hana.Domain.Credit;

namespace Hana.Domain.Tests;

public sealed class GeographicAllocationDatasetV1Tests
{
    [Fact]
    public void DatasetContainsOneCompleteRowForEachOfThirtyOneProvinces()
    {
        Assert.Equal(31, GeographicAllocationDatasetV1.Provinces.Count);
        Assert.Equal(31, GeographicAllocationDatasetV1.Provinces
            .Select(x => x.ProvinceName).Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(31, GeographicAllocationDatasetV1.Provinces
            .Select(x => x.ProvincialCapitalName).Distinct(StringComparer.Ordinal).Count());
        Assert.All(GeographicAllocationDatasetV1.Provinces, row =>
        {
            Assert.InRange(row.UrbanMpi, 0m, 1m);
            Assert.InRange(row.RuralMpi, 0m, 1m);
            Assert.InRange(row.UrbanPrevalence, 0m, 1m);
            Assert.InRange(row.RuralPrevalence, 0m, 1m);
            Assert.InRange(row.UrbanIntensity, 0m, 1m);
            Assert.InRange(row.RuralIntensity, 0m, 1m);
        });
    }

    [Fact]
    public void UsesAllSixtyTwoMpiValuesForSameVersionMinimumAndMaximum()
    {
        Assert.Equal(0.000144m, GeographicAllocationDatasetV1.MinimumMpi);
        Assert.Equal(0.211365m, GeographicAllocationDatasetV1.MaximumMpi);
    }

    [Fact]
    public void AppliesCapitalAdjustmentOnlyWhenCityMatchesProvinceCapital()
    {
        var capital = GeographicAllocationDatasetV1.ForCity("زنجان", "زنجان");
        var otherCity = GeographicAllocationDatasetV1.ForCity("زنجان", "ابهر");

        Assert.Equal(0.003241m, capital.RawMpi);
        Assert.True(capital.IsProvincialCapital);
        Assert.Equal(capital.BaseFactor * 1.20m, capital.Factor);
        Assert.False(otherCity.IsProvincialCapital);
        Assert.Equal(otherCity.BaseFactor, otherCity.Factor);
        Assert.Equal(capital.BaseFactor, otherCity.BaseFactor);
    }

    [Fact]
    public void NonCityUsesRuralDataWithoutCapitalAdjustment()
    {
        var result = GeographicAllocationDatasetV1.ForNonCity("زنجان");

        Assert.False(result.IsUrban);
        Assert.False(result.IsProvincialCapital);
        Assert.Equal(0.015836m, result.RawMpi);
        Assert.Equal(result.BaseFactor, result.Factor);
    }

    [Fact]
    public void UnknownProvinceAndMissingCityFailClosed()
    {
        Assert.Throws<KeyNotFoundException>(() =>
            GeographicAllocationDatasetV1.ForNonCity("استان ساختگی"));
        Assert.Throws<ArgumentException>(() =>
            GeographicAllocationDatasetV1.ForCity("زنجان", " "));
    }

    [Fact]
    public void CarriesDatasetVersionAndSourceIdentity()
    {
        var result = GeographicAllocationDatasetV1.ForCity("گیلان", "رشت");

        Assert.Equal(GeographicAllocationDatasetV1.Version, result.DatasetVersion);
        Assert.Equal("HANA-GEO-MPI-1400-v1", result.DatasetVersion);
        Assert.Contains("۱۴۰۰", GeographicAllocationDatasetV1.SourceReport);
        Assert.Contains("جدول شهری", GeographicAllocationDatasetV1.UrbanSourceReference);
        Assert.Contains("جدول روستایی", GeographicAllocationDatasetV1.RuralSourceReference);
    }
}
