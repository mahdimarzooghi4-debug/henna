import type { BuyerProduct } from "./buyer-catalog";

export type BuyerFigmaDemoProduct = BuyerProduct & { image: string; samplePrice: string };

export const BUYER_FIGMA_DEMO_PRODUCTS: BuyerFigmaDemoProduct[] = [
  { id: "fa000001-0000-4000-8000-000000000001", categoryId: "fa000000-0000-4000-8000-000000000001", name: "روغن آفتابگردان خالص", kind: "GOOD", description: "۱ لیتر · تولید ایرانی", image: "/landing/figma/product-oil.png", samplePrice: "۸۹,۰۰۰" },
  { id: "fa000002-0000-4000-8000-000000000002", categoryId: "fa000000-0000-4000-8000-000000000001", name: "برنج هاشمی درجه یک", kind: "GOOD", description: "۵ کیلوگرم · محصول شمال", image: "/landing/figma/product-rice.png", samplePrice: "۲۰۵,۰۰۰" },
  { id: "fa000003-0000-4000-8000-000000000003", categoryId: "fa000000-0000-4000-8000-000000000002", name: "ماست سون همزده پرچرب", kind: "GOOD", description: "۹۰۰ گرم · لبنیات محلی", image: "/landing/figma/product-yogurt.png", samplePrice: "۴۸,۵۰۰" },
  { id: "fa000004-0000-4000-8000-000000000004", categoryId: "fa000000-0000-4000-8000-000000000002", name: "پنیر سفید ایرانی ممتاز", kind: "GOOD", description: "۴۰۰ گرم · لبنیات هراز", image: "/landing/figma/product-cheese.png", samplePrice: "۵۴,۰۰۰" },
  { id: "fa000005-0000-4000-8000-000000000005", categoryId: "fa000000-0000-4000-8000-000000000003", name: "چای سیاه ارگانیک لاهیجان", kind: "GOOD", description: "۲۵۰ گرم · ممتاز زربوی", image: "/landing/figma/product-tea.png", samplePrice: "۱۲۸,۰۰۰" },
];
