import { normalizeDigits } from "./phone.ts";

/**
 * Local code-entry check for the EXISTING Expo buyer OTP step. Invalid input
 * cannot consume a server verification attempt, nor trigger bearer storage.
 * Persian and Arabic digit glyphs are normalized exactly as in transport.
 */
export function validateOtpEntry(rawCode: string): {
  code: string;
  error: string | null;
} {
  const code = normalizeDigits(rawCode.trim());
  return {
    code,
    error: /^\d{6}$/.test(code)
      ? null
      : "کد تأیید باید شش رقم باشد.",
  };
}
