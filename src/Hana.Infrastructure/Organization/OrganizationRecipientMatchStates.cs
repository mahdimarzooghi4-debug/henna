namespace Hana.Infrastructure.Organization;

public static class OrganizationRecipientMatchStates
{
    public const string Matched = "MATCHED";
    public const string NeedsMatch = "NEEDS_MATCH";
    public const string PendingReview = "PENDING_REVIEW";

    public static bool IsKnown(string? value) =>
        value is Matched or NeedsMatch or PendingReview;
}
