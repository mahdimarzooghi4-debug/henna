namespace Hana.Infrastructure.Organization;

public static class OrganizationBeneficiarySources
{
    public const string Manual = "MANUAL";
    public const string Api = "API";
    public const string ApiOrManual = "API_OR_MANUAL";

    public static bool IsKnown(string? value) =>
        value is Manual or Api or ApiOrManual;
}
