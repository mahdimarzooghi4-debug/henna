/** Offline design-preview state only; never a commerce DTO or API request. */
export const previewPrices = { tea: 34000, oil: 68000, rice: 185000, yogurt: 12000, cheese: 45000 } as const;
export type PreviewProductKey = keyof typeof previewPrices;
export type PreviewCart = Partial<Record<PreviewProductKey, number>>;
export function changePreviewQuantity(cart: PreviewCart, key: PreviewProductKey, delta: number): PreviewCart {
  if (!Object.prototype.hasOwnProperty.call(previewPrices,key) || !Number.isInteger(delta)) return cart;
  const current = cart[key] ?? 0;
  const next = Math.max(0, Math.min(99,current + delta));
  if (next === current) return cart;
  const result = {...cart};
  if (next === 0) delete result[key]; else result[key] = next;
  return result;
}
export function previewCartCount(cart: PreviewCart): number {
  return (Object.keys(previewPrices) as PreviewProductKey[]).reduce((sum,key)=>sum+(cart[key]??0),0);
}
export function previewCartTotal(cart: PreviewCart): number {
  return (Object.keys(previewPrices) as PreviewProductKey[]).reduce((sum,key)=>sum+(cart[key]??0)*previewPrices[key],0);
}
