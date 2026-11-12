/**
 * Pricing design-preview only: these helpers do not set marketplace prices.
 * All amounts are integer tomans solely for the sample preview UI.
 * Real seller offers and quote totals remain governed by backend rial contracts.
 */
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function parsePreviewToman(value: string): number | null {
  const ascii = value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[٬,]/g, "").trim();
  if (!/^[0-9]+$/.test(ascii)) return null;
  const n = Number(ascii);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function previewDiscount(
  baseToman: number, finalToman: number,
): { finalToman: number; savedToman: number } | null {
  if (!Number.isSafeInteger(baseToman) || baseToman <= 1 ||
      !Number.isSafeInteger(finalToman) || finalToman < 1 ||
      finalToman >= baseToman) return null;
  return { finalToman, savedToman: baseToman - finalToman };
}
