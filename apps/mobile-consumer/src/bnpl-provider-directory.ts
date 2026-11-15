/**
 * Provider sites are for account-level discovery only. Henna has no merchant
 * payment connection for these providers, so none can be selected at checkout.
 */
export const bnplProviderDirectory = [
  {
    id: "snapppay",
    name: "اسنپ‌پی",
    website: "https://snapppay.ir/",
    description: "بررسی شرایط خرید اعتباری در سایت رسمی اسنپ‌پی.",
  },
  {
    id: "digipay",
    name: "دیجی‌پی",
    website: "https://www.mydigipay.com/",
    description: "بررسی طرح‌ها و شرایط دریافت اعتبار در سایت رسمی دیجی‌پی.",
  },
  {
    id: "tara",
    name: "تارا",
    website: "https://taracredit.com/",
    description: "بررسی خدمات اعتباری و شرایط درخواست در سایت رسمی تارا.",
  },
] as const;
