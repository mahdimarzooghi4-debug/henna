import type { SellerFields } from "./seller-draft-preflight";

/**
 * Comparison for a real 409 on the existing Figma-approved seller first step.
 * Both copies stay only in React memory; never write seller PII to storage,
 * query parameters, logs or an unapproved server-side merge endpoint.
 */
export const sellerFieldLabels: Record<keyof SellerFields, string> = {
  storeName: "نام فروشگاه",
  ownerName: "نام و نام خانوادگی مسئول",
  phone: "شماره موبایل",
  city: "شهر / منطقه",
  address: "آدرس فروشگاه",
  postalCode: "کدپستی",
};

export type SellerFieldDifference = {
  key: keyof SellerFields;
  label: string;
  mine: string;
  onServer: string;
};

export function sellerFieldDifferences(
  mine: SellerFields, onServer: SellerFields,
): SellerFieldDifference[] {
  return (Object.keys(sellerFieldLabels) as (keyof SellerFields)[])
    .filter((key) => mine[key] !== onServer[key])
    .map((key) => ({
      key,
      label: sellerFieldLabels[key],
      mine: mine[key],
      onServer: onServer[key],
    }));
}
