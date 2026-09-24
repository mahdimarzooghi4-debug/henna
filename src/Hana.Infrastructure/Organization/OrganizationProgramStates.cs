namespace Hana.Infrastructure.Organization;

public static class OrganizationProgramStates
{
    public const string Draft = "DRAFT";
    public const string Registered = "REGISTERED";
    public const string Active = "ACTIVE";
    public const string Paused = "PAUSED";
    public const string Ended = "ENDED";

    public static bool IsKnown(string? value) =>
        value is Draft or Registered or Active or Paused or Ended;
}
