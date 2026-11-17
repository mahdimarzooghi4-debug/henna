/**
 * Independently available provider websites for account-level discovery only.
 * Listings do NOT mean Hana is an authorized merchant, and cannot enable checkout.
 * Reviewed source websites: snapppay.ir, mydigipay.com, taracredit.com (Nov 2026).
 */
export type BnplDirectoryProvider = Readonly<{
  id: "snapppay" | "digipay" | "tara";
  name: string;
  shortName: string;
  website: string;
  description: string;
}>;

export const bnplProviderDirectory: readonly BnplDirectoryProvider[] = [
  {
    id: "snapppay", name: "اسنپ‌پی", shortName: "اسنپ",
    website: "https://snapppay.ir/",
    description: "آشنایی با خدمات خرید اعتباری و ثبت درخواست در سامانه اسنپ‌پی.",
  },
  {
    id: "digipay", name: "دیجی‌پی", shortName: "دیجی",
    website: "https://www.mydigipay.com/",
    description: "بررسی طرح‌های اعتباری و شرایط دریافت اعتبار در سامانه دیجی‌پی.",
  },
  {
    id: "tara", name: "تارا", shortName: "تارا",
    website: "https://taracredit.com/",
    description: "آشنایی با خدمات اعتباری و شیوه درخواست اعتبار در سامانه تارا.",
  },
];

/** 
 * NO merchant payment adapter, order/payment/settlement contract or credentials
 * exist for these providers in Hana's Stage web checkout. Never turn a listing
 * into an enabled payment method merely by changing frontend configuration.
 */
export const bnplCheckoutConnected = false as const;
