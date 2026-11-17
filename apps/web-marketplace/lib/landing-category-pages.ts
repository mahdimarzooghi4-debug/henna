/** Figma landing's seven descriptive categories; not a published catalog taxonomy. */
export const LANDING_CATEGORIES = [
  { slug: "bread-and-pastry", label: "نان و شیرینی", image: "category-bread.png", description: "مرور نان و شیرینی‌هایی که در کاتالوگ تأییدشده حنا منتشر شده‌اند." },
  { slug: "canned-and-ready", label: "کنسرو و آماده", image: "category-canned.png", description: "مرور کالاهای کنسروی و آماده، در صورت وجود دسته متناظر منتشرشده." },
  { slug: "health-and-hygiene", label: "بهداشتی و سلامت", image: "category-health.png", description: "مرور محصولات بهداشتی و مراقبتی منتشرشده در کاتالوگ حنا." },
  { slug: "fruit-and-vegetables", label: "میوه و صیفی", image: "category-produce.png", description: "مرور میوه و صیفی از دسته‌های واقعی و منتشرشده فروشگاهی." },
  { slug: "oil-and-grocery", label: "روغن و خواربار", image: "category-grocery.png", description: "مرور روغن و خواربار منتشرشده در فهرست واقعی کالاها." },
  { slug: "drinks", label: "نوشیدنی‌ها", image: "category-drinks.png", description: "مرور نوشیدنی‌های موجود در دسته‌بندی‌های منتشرشده حنا." },
  { slug: "local-dairy", label: "لبنیات محلی", image: "category-dairy.png", description: "مرور محصولات لبنی در صورت انتشار دسته متناظر در کاتالوگ." },
] as const;

export function landingCategoryBySlug(slug: string) {
  return LANDING_CATEGORIES.find(category => category.slug === slug) ?? null;
}

export function landingCategoryHref(slug: string) {
  return "/categories/" + slug;
}
