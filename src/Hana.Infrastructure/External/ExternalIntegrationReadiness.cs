namespace Hana.Infrastructure.External;

/// <summary>
/// Provider readiness boundary for external payment processing.
/// Concrete provider request/response methods are intentionally not frozen
/// until the contracted PSP adapter is supplied.
/// </summary>
public interface IExternalPaymentProvider
{
    bool IsAvailable { get; }
}

/// <summary>
/// Shipping default. External card/bank payment stays unavailable.
/// </summary>
public sealed class UnconfiguredExternalPaymentProvider
    : IExternalPaymentProvider
{
    public bool IsAvailable => false;
}

/// <summary>
/// Provider readiness boundary for the independently supplied logistics
/// business. Operational fleet logic never lives in the marketplace core.
/// </summary>
public interface IExternalLogisticsProvider
{
    bool IsAvailable { get; }
}

/// <summary>
/// Shipping default. Delivery jobs cannot be created without the real adapter.
/// </summary>
public sealed class UnconfiguredExternalLogisticsProvider
    : IExternalLogisticsProvider
{
    public bool IsAvailable => false;
}
