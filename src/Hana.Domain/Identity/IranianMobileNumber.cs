namespace Hana.Domain.Identity;

/// <summary>
/// Formats an Iranian 09 mobile number for the authentication boundary.
/// This is syntactic validation, NOT proof that a person owns this number.
/// </summary>
public sealed record IranianMobileNumber
{
    public string Value { get; }

    private IranianMobileNumber(string value) => Value = value;

    public static bool TryParse(string? input, out IranianMobileNumber? mobile)
    {
        mobile = null;
        if (string.IsNullOrWhiteSpace(input))
            return false;

        var trimmed = input.Trim();
        if (trimmed.Length != 11)
            return false;

        Span<char> digits = stackalloc char[11];
        for (var index = 0; index < trimmed.Length; index++)
        {
            var ch = trimmed[index];
            digits[index] = ch switch
            {
                >= '\u06F0' and <= '\u06F9' => (char)('0' + ch - '\u06F0'),
                >= '\u0660' and <= '\u0669' => (char)('0' + ch - '\u0660'),
                >= '0' and <= '9' => ch,
                _ => '\0'
            };
        }

        if (digits[0] != '0' || digits[1] != '9')
            return false;

        for (var index = 0; index < digits.Length; index++)
        {
            if (digits[index] is < '0' or > '9')
                return false;
        }

        mobile = new IranianMobileNumber(new string(digits));
        return true;
    }

    public override string ToString() => "[redacted mobile]";
}
