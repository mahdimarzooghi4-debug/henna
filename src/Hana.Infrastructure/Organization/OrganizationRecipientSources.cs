namespace Hana.Infrastructure.Organization;

public static class OrganizationRecipientSources
{
    public const string Manual = "MANUAL";
    public const string Api = "API";

    public static bool IsKnown(string? value) =>
        value is Manual or Api;
}
