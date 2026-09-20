namespace Hana.Infrastructure.Identity;

/// <summary>
/// Persistence record, not a beneficiary eligibility or seller approval.
/// Verified phone is an independent state; having an account confers no credit.
/// </summary>
public sealed class AccountRecord
{
    public Guid Id { get; set; }
    public string NormalizedPhone { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? PhoneVerifiedAtUtc { get; set; }
}
