namespace Hana.Api;

internal static class SellerIdentityInputValidation
{
    internal static string NormalizeDigits(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var trimmed = value.Trim();
        if (trimmed.Length > 64) return string.Empty;
        Span<char> buffer = stackalloc char[trimmed.Length];
        var index = 0;
        foreach (var ch in trimmed)
        {
            buffer[index++] = ch switch
            {
                '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
                '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
                '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
                '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
                _ => ch
            };
        }
        return new string(buffer[..index]);
    }

    internal static bool IsIranianNationalCode(string? value)
    {
        var code = NormalizeDigits(value);
        if (code.Length != 10 || code.Any(ch => ch is < '0' or > '9'))
            return false;
        if (code.All(ch => ch == code[0])) return false;

        var sum = 0;
        for (var i = 0; i < 9; i++)
            sum += (code[i] - '0') * (10 - i);
        var remainder = sum % 11;
        var check = remainder < 2 ? remainder : 11 - remainder;
        return check == code[9] - '0';
    }

    internal static bool IsElevenDigits(string? value)
    {
        var normalized = NormalizeDigits(value);
        return normalized.Length == 11 &&
            normalized.All(ch => ch is >= '0' and <= '9');
    }

    internal static bool IsPhone(string? value)
    {
        var normalized = NormalizeDigits(value);
        return normalized.Length == 11 &&
            normalized.StartsWith("09", StringComparison.Ordinal) &&
            normalized.All(ch => ch is >= '0' and <= '9');
    }

    internal static string? CleanText(string? value, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > maxLength ||
            text.Any(ch => char.IsControl(ch)))
            return null;
        return text;
    }
}
