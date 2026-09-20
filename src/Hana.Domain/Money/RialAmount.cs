namespace Hana.Domain.Money;

/// <summary>
/// A non-negative monetary magnitude in Iranian rials. Ledger signs/directions
/// and business-specific fees will be modeled explicitly in their own modules.
/// </summary>
public readonly record struct RialAmount
{
    public long Value { get; }

    public RialAmount(long value)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(value);
        Value = value;
    }
}
