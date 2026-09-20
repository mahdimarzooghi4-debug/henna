namespace Hana.Infrastructure.Identity;

/// <summary>
/// Provider-specific adapter contract. No provider credentials or implementation
/// belong in web/mobile clients. An accepted result means the provider accepted
/// the message for delivery, NOT proof of handset receipt.
/// </summary>
public interface IOtpSmsSender
{
    bool IsAvailable { get; }

    Task<OtpSmsDeliveryResult> SendAsync(
        string normalizedMobile,
        string plaintextCode,
        CancellationToken cancellationToken);
}

public sealed record OtpSmsDeliveryResult(bool Accepted, string? ProviderReference);

/// <summary>
/// Production default until a real SMS provider is contracted and configured.
/// Never pretends an OTP was delivered.
/// </summary>
public sealed class UnconfiguredOtpSmsSender : IOtpSmsSender
{
    public bool IsAvailable => false;

    public Task<OtpSmsDeliveryResult> SendAsync(
        string normalizedMobile, string plaintextCode, CancellationToken cancellationToken) =>
        Task.FromResult(new OtpSmsDeliveryResult(false, null));
}
