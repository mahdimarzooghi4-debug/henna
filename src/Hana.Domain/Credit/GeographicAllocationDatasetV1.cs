namespace Hana.Domain.Credit;

public sealed record ProvincialNeedMetricsV1(
    string ProvinceName,
    string ProvincialCapitalName,
    decimal UrbanPrevalence,
    decimal UrbanIntensity,
    decimal UrbanMpi,
    decimal RuralPrevalence,
    decimal RuralIntensity,
    decimal RuralMpi);

public sealed record HouseholdGeographicFactorV1(
    string DatasetVersion,
    string ProvinceName,
    string? CityName,
    bool IsUrban,
    bool IsProvincialCapital,
    decimal RawMpi,
    decimal MinimumMpi,
    decimal MaximumMpi,
    decimal BaseFactor,
    decimal Factor);

/// <summary>
/// Versioned 1400 provincial urban/rural MPI inputs transcribed from the
/// supplied مجلس Research Center report tables and matched to the supplied
/// Ministry of Interior administrative divisions workbook.
/// </summary>
public static class GeographicAllocationDatasetV1
{
    public const string Version = "HANA-GEO-MPI-1400-v1";
    public const string SourceReport = "نحوه محاسبه شاخص فقر چندبعدی ملی — گزارش سال ۱۴۰۰";
    public const string UrbanSourceReference = "جدول شهری ۷، صفحات ۶۴–۶۵";
    public const string RuralSourceReference = "جدول روستایی ۸، صفحه ۶۶";
    public const decimal CapitalAdjustment = 1.20m;

    private static readonly IReadOnlyList<ProvincialNeedMetricsV1> Rows =
        Array.AsReadOnly(new ProvincialNeedMetricsV1[]
        {
        new("آذربایجان شرقی", "تبریز", 0.00365205m, 0.3538514m, 0.001292m, 0.01814391m, 0.3719576m, 0.006749m),
        new("آذربایجان غربی", "ارومیه", 0.00043097m, 0.3333333m, 0.000144m, 0.01069487m, 0.3486492m, 0.003729m),
        new("اردبیل", "اردبیل", 0.04403743m, 0.3883306m, 0.017101m, 0.05582454m, 0.3966478m, 0.022143m),
        new("اصفهان", "اصفهان", 0.0022593m, 0.3570031m, 0.000807m, 0.01305439m, 0.3672423m, 0.004794m),
        new("البرز", "کرج", 0.00942935m, 0.3519882m, 0.003319m, 0.03370802m, 0.3587101m, 0.012091m),
        new("ایلام", "ایلام", 0.0061921m, 0.3620232m, 0.002242m, 0.01479464m, 0.3894542m, 0.005762m),
        new("بوشهر", "بوشهر", 0.0139641m, 0.420327m, 0.005869m, 0.01939305m, 0.3607095m, 0.006995m),
        new("تهران", "تهران", 0.01418193m, 0.3699461m, 0.005247m, 0.02281058m, 0.3557957m, 0.008116m),
        new("چهارمحال و بختیاری", "شهرکرد", 0.00847969m, 0.4120328m, 0.003494m, 0.04778704m, 0.399768m, 0.019104m),
        new("خراسان جنوبی", "بیرجند", 0.01864153m, 0.380117m, 0.007086m, 0.1138835m, 0.4411426m, 0.050239m),
        new("خراسان رضوی", "مشهد", 0.00295337m, 0.3681405m, 0.001087m, 0.02587484m, 0.375211m, 0.009709m),
        new("خراسان شمالی", "بجنورد", 0.03802436m, 0.3892215m, 0.0148m, 0.06806523m, 0.3986412m, 0.027134m),
        new("خوزستان", "اهواز", 0.01961575m, 0.3344209m, 0.00656m, 0.02242582m, 0.3672135m, 0.008235m),
        new("زنجان", "زنجان", 0.0084008m, 0.3858169m, 0.003241m, 0.03980105m, 0.3978792m, 0.015836m),
        new("سمنان", "سمنان", 0.00062301m, 0.3666667m, 0.000228m, 0.01717892m, 0.3661312m, 0.00629m),
        new("سیستان و بلوچستان", "زاهدان", 0.2342667m, 0.4273043m, 0.100103m, 0.4790696m, 0.4411987m, 0.211365m),
        new("فارس", "شیراز", 0.01523371m, 0.3647511m, 0.005557m, 0.01700382m, 0.3611192m, 0.00614m),
        new("قزوین", "قزوین", 0.00625327m, 0.3774971m, 0.002361m, 0.00610225m, 0.3450525m, 0.002106m),
        new("قم", "قم", 0.00640899m, 0.4244928m, 0.002721m, 0.02561728m, 0.376506m, 0.009645m),
        new("کردستان", "سنندج", 0.002576m, 0.3430964m, 0.000884m, 0.02825207m, 0.3772485m, 0.010658m),
        new("کرمان", "کرمان", 0.06340513m, 0.3800063m, 0.024094m, 0.1716943m, 0.4077679m, 0.070011m),
        new("کرمانشاه", "کرمانشاه", 0.02023959m, 0.3684144m, 0.007457m, 0.0331891m, 0.4153286m, 0.013784m),
        new("کهگیلویه و بویراحمد", "یاسوج", 0.01214711m, 0.3483869m, 0.004232m, 0.04680948m, 0.3763784m, 0.017618m),
        new("گلستان", "گرگان", 0.01137705m, 0.3833448m, 0.004361m, 0.0150147m, 0.3902422m, 0.005859m),
        new("گیلان", "رشت", 0.01618538m, 0.3607114m, 0.005838m, 0.04871228m, 0.3718374m, 0.018113m),
        new("لرستان", "خرم آباد", 0.01373177m, 0.3485303m, 0.004786m, 0.04982759m, 0.3880613m, 0.019336m),
        new("مازندران", "ساری", 0.00734628m, 0.3827175m, 0.002812m, 0.01213228m, 0.3849537m, 0.00467m),
        new("مرکزی", "اراک", 0.00602213m, 0.3493064m, 0.002104m, 0.03125189m, 0.3920883m, 0.012254m),
        new("هرمزگان", "بندرعباس", 0.02766118m, 0.379925m, 0.010509m, 0.0463042m, 0.4000673m, 0.018525m),
        new("همدان", "همدان", 0.02071166m, 0.3766507m, 0.007801m, 0.02615224m, 0.3651345m, 0.009549m),
        new("یزد", "یزد", 0.00867022m, 0.3713763m, 0.00322m, 0.02557112m, 0.4114356m, 0.010521m)
        });

    private static readonly IReadOnlyDictionary<string, ProvincialNeedMetricsV1> ByProvince =
        Rows.ToDictionary(x => x.ProvinceName, StringComparer.Ordinal);

    public static IReadOnlyList<ProvincialNeedMetricsV1> Provinces => Rows;

    public static decimal MinimumMpi => Rows
        .SelectMany(x => new[] { x.UrbanMpi, x.RuralMpi }).Min();

    public static decimal MaximumMpi => Rows
        .SelectMany(x => new[] { x.UrbanMpi, x.RuralMpi }).Max();

    /// <summary>
    /// Resolve an urban city using a city name already validated by the
    /// canonical geography registry. Only the exact provincial capital name
    /// receives the 20% adjustment.
    /// </summary>
    public static HouseholdGeographicFactorV1 ForCity(string provinceName, string cityName)
    {
        if (string.IsNullOrWhiteSpace(cityName))
            throw new ArgumentException("A validated city name is required.", nameof(cityName));

        var province = FindProvince(provinceName);
        var isCapital = string.Equals(
            cityName.Trim(), province.ProvincialCapitalName, StringComparison.Ordinal);

        return Create(province, cityName.Trim(), isUrban: true, isCapital);
    }

    /// <summary>
    /// Non-city administrative locations use the province's rural MPI value.
    /// This method does not create a location or assert service availability.
    /// </summary>
    public static HouseholdGeographicFactorV1 ForNonCity(string provinceName)
    {
        var province = FindProvince(provinceName);
        return Create(province, cityName: null, isUrban: false, isProvincialCapital: false);
    }

    private static ProvincialNeedMetricsV1 FindProvince(string provinceName)
    {
        if (string.IsNullOrWhiteSpace(provinceName))
            throw new ArgumentException("A canonical province name is required.", nameof(provinceName));

        if (!ByProvince.TryGetValue(provinceName.Trim(), out var province))
            throw new KeyNotFoundException("Province is not present in this geography dataset.");

        return province;
    }

    private static HouseholdGeographicFactorV1 Create(
        ProvincialNeedMetricsV1 province, string? cityName, bool isUrban, bool isProvincialCapital)
    {
        var mpi = isUrban ? province.UrbanMpi : province.RuralMpi;
        var baseFactor = NeedsBasedAllocationV1.CalculateGeographicFactor(
            mpi, MinimumMpi, MaximumMpi, isProvincialCapital: false);
        var factor = isProvincialCapital
            ? baseFactor * CapitalAdjustment
            : baseFactor;

        return new HouseholdGeographicFactorV1(
            Version, province.ProvinceName, cityName, isUrban, isProvincialCapital,
            mpi, MinimumMpi, MaximumMpi, baseFactor, factor);
    }
}
