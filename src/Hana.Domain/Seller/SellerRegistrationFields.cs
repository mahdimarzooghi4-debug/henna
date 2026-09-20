using Hana.Domain.Identity;

namespace Hana.Domain.Seller;

/// <summary>
/// Validation for first-stage seller draft only: no approval, activation,
/// document verification or geographical entitlement is implied.
/// </summary>
public sealed record SellerRegistrationFields(
    string StoreName, string OwnerName, string Phone,
    string City, string Address, string PostalCode)
{
    public static bool TryCreate(
        string? storeName, string? ownerName, string? phone,
        string? city, string? address, string? postalCode,
        out SellerRegistrationFields? fields)
    {
        fields = null;
        if (!IranianMobileNumber.TryParse(phone, out var normalizedPhone) ||
            !TryText(storeName, 120, out var name) ||
            !TryText(ownerName, 120, out var owner) ||
            !TryText(city, 120, out var location) ||
            !TryText(address, 500, out var street) ||
            !TryPostalCode(postalCode, out var zip))
            return false;

        fields = new(name!, owner!, normalizedPhone!.Value,
            location!, street!, zip!);
        return true;
    }

    private static bool TryText(string? value, int max, out string? result)
    {
        result = value?.Trim();
        return result is { Length: > 0 } &&
            result.Length <= max && !result.Any(char.IsControl);
    }

    private static bool TryPostalCode(string? input, out string? result)
    {
        result = null;
        var trimmed = input?.Trim();
        if (trimmed is not { Length: 10 }) return false;
        Span<char> digits = stackalloc char[10];
        for (var i = 0; i < trimmed.Length; i++)
        {
            digits[i] = trimmed[i] switch
            {
                >= '0' and <= '9' => trimmed[i],
                >= '\u06F0' and <= '\u06F9' =>
                    (char)('0' + trimmed[i] - '\u06F0'),
                >= '\u0660' and <= '\u0669' =>
                    (char)('0' + trimmed[i] - '\u0660'),
                _ => '\0'
            };
            if (digits[i] == '\0') return false;
        }

        result = new string(digits);
        return true;
    }
}
