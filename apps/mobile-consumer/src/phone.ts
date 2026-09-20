/** Normalize Iranian Persian and Arabic keypad digits before validation. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

export function normalizeIranianMobile(value: string): string {
  return normalizeDigits(value.trim());
}

export function isValidIranianMobile(value: string): boolean {
  return /^09\d{9}$/.test(normalizeIranianMobile(value));
}
