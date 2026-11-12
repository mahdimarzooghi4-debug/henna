/** Normalize Persian and Arabic numerals to ASCII before validation. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/** Render digits in Persian without changing identifier or numeric value. */
export function toPersianDigits(value: string | number): string {
  return normalizeDigits(String(value)).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}
