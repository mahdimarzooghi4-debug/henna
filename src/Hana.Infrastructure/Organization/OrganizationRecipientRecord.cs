namespace Hana.Infrastructure.Organization;

/// <summary>
/// A person enrolled in one organization program. This is an enrollment/read
/// model only: it is not an allocation, entitlement, wallet balance or ledger
/// record. Raw identity documents are deliberately not stored here.
/// </summary>
public sealed class OrganizationRecipientRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid ProgramId { get; set; }
    public string DisplayName { get; set; } = null!;
    public string ReferenceMasked { get; set; } = null!;
    public string Source { get; set; } = OrganizationRecipientSources.Manual;
    public string MatchStatus { get; set; } =
        OrganizationRecipientMatchStates.PendingReview;
    public Guid? MatchedAccountId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
