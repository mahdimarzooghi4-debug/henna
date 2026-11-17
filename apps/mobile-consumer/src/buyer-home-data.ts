const homeImages = {
  cheese: require("../assets/home-product-1.jpg"),
  yogurt: require("../assets/home-product-2.jpg"),
  rice: require("../assets/home-product-3.jpg"),
  oil: require("../assets/home-product-4.jpg"),
  tea: require("../assets/home-product-5.jpg"),
};
export const buyerHomeProducts = [
  { id: "cheese", title: "پنیر سفید صبحانه", category: "لبنیات", amount: 45000, price: "۴۵,۰۰۰ تومان", oldPrice: "۵۲,۰۰۰", badge: "طرح ویژه", image: homeImages.cheese },
  { id: "yogurt", title: "ماست کم‌چرب", category: "لبنیات", amount: 12000, price: "۱۲,۰۰۰ تومان", oldPrice: "", badge: "کالابرگ", image: homeImages.yogurt },
  { id: "rice", title: "برنج طارم ایرانی", category: "خواربار", amount: 185000, price: "۱۸۵,۰۰۰ تومان", oldPrice: "", badge: "کالابرگ", image: homeImages.rice },
  { id: "oil", title: "روغن مایع آفتابگردان", category: "خواربار", amount: 68000, price: "۶۸,۰۰۰ تومان", oldPrice: "۷۹,۰۰۰", badge: "٪ تخفیف", image: homeImages.oil },
  { id: "tea", title: "چای سیاه", category: "نوشیدنی", amount: 34000, price: "۳۴,۰۰۰ تومان", oldPrice: "", badge: "طرح ویژه", image: homeImages.tea },
] as const;

export const buyerHomeCategories = [
  { title: "لبنیات", image: require("../assets/home-category-dairy.png") },
  { title: "خواربار", image: require("../assets/home-category-grocery.png") },
  { title: "نوشیدنی", image: require("../assets/home-category-drinks.png") },
  { title: "پروتئینی", image: require("../assets/home-category-protein.png") },
] as const;
