import type { SellerFields } from "./seller-draft-preflight";
import { sellerFieldLabels } from "./seller-conflict.ts";
import { normalizeDigits } from "./normalize-digits.ts";

/** Mirrors first-stage domain length/control checks, not business approval. */
export type SellerFieldErrors = Partial<Record<keyof SellerFields, string>>;
const keys = Object.keys(sellerFieldLabels) as (keyof SellerFields)[];
const maxLengths: Record<keyof SellerFields, number> = {
  storeName: 120, ownerName: 120, phone: 11,
  city: 120, address: 500, postalCode: 10,
};
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u;

export function hasUnsavedSellerEdits(
  fields: SellerFields,
  lastConfirmed: SellerFields,
): boolean {
  return keys.some((key) => fields[key] !== lastConfirmed[key]);
}

export function validateSellerDraft(fields: SellerFields): {
  values: SellerFields;
  errors: SellerFieldErrors;
  firstInvalid: keyof SellerFields | null;
} {
  const values: SellerFields = {
    ...fields, storeName: fields.storeName.trim(),
    ownerName: fields.ownerName.trim(), city: fields.city.trim(),
    address: fields.address.trim(),
    phone: normalizeDigits(fields.phone.trim()),
    postalCode: normalizeDigits(fields.postalCode.trim()),
  };
  const errors: SellerFieldErrors = {};
  for (const key of keys) {
    const value = values[key];
    if (!value) {
      errors[key] = `${sellerFieldLabels[key]} الزامی است.`;
    } else if (controlCharacters.test(value)) {
      errors[key] = `${sellerFieldLabels[key]} شامل نویسهٔ نامعتبر است.`;
    } else if (value.length > maxLengths[key]) {
      errors[key] = `${sellerFieldLabels[key]} بیش از حد مجاز است.`;
    } else if (key === "phone" && !/^09\d{9}$/.test(value)) {
      errors.phone = "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.";
    } else if (key === "postalCode" && !/^\d{10}$/.test(value)) {
      errors.postalCode = "کدپستی باید دقیقاً ۱۰ رقم داشته باشد.";
    }
  }

  return {
    values, errors,
    firstInvalid: keys.find((key) => errors[key] !== undefined) ?? null,
  };
}

/** Exact same-tab link change, excluding anchors and modified/middle clicks. */
export function isLeavingSellerPage(
  destination: string,
  current: string,
): boolean {
  try {
    const from = new URL(current);
    const to = new URL(destination, from);
    return to.origin !== from.origin ||
      to.pathname !== from.pathname ||
      to.search !== from.search;
  } catch {
    // An invalid, unusual href should never bypass a pending-changes guard.
    return true;
  }
}
