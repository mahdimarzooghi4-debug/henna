namespace Hana.Infrastructure.Seller;

public enum SellerIdentityVerificationResult
{
    Verified,
    NotMatched,
    Unavailable
}

public interface ISellerNaturalIdentityVerifier
{
    bool IsAvailable { get; }

    Task<SellerIdentityVerificationResult> VerifyAsync(
        string nationalCode,
        string verifiedPhone,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Shipping default: no authorized identity provider is configured.
/// Never infer or fabricate verification from locally-entered fields.
/// </summary>
public sealed class UnconfiguredSellerNaturalIdentityVerifier
    : ISellerNaturalIdentityVerifier
{
    public bool IsAvailable => false;

    public Task<SellerIdentityVerificationResult> VerifyAsync(
        string nationalCode,
        string verifiedPhone,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(SellerIdentityVerificationResult.Unavailable);
}
