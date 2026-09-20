# Catalog 001 — API عمومی خواندن هویت کالا و خدمت

**دامنه:** شروع مسیر واقعی خریدار پس از مراحل Identity و Seller، بدون جعل صفحهٔ خانه/لیست کالا که هنوز در Figma متصل طرح مصوب آن موجود نیست.

## مرجع محصول و محدوده

- طبق [معماری V1](../architecture/HANA-FULL-PRODUCT-NATIONAL-ARCHITECTURE-v1.0.md)، Catalog/CMS مالک هویت کالا، خدمت، دسته و وضعیت انتشار است؛ قیمت، موجودی، عرضه فروشنده و محدوده تحویل متعلق به Offer/Inventory و Geography هستند. انتشار هویت محصول به معنی قابل‌خریدبودن نیست.
- Figma متصل [henna-platform](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform) هنگام این مرحله فقط صفحه Foundations و فریم‌های ورود وب `160:40`، ورود اپ خریدار `160:58` و ثبت‌نام فروشگاه وب `160:77` را برای اجرا داشت؛ فریم فروشگاه موبایل `160:111` صریحاً خارج از دامنه است. **صفحه فهرست/جزئیات محصول از روی حدس به کد تبدیل نشد.**

## آنچه پیاده شده است

- schema مستقل `catalog` در PostgreSQL، با `categories` و `products`؛ migration `20260920211000_InitialCatalog` و تاریخچه EF مستقل در `catalog.__EFMigrationsHistory`. startup عمومی migration نمی‌کند؛ فرمان عملیاتی `--apply-migrations` این schema را پس از Identity و Seller اعمال می‌کند و readiness نسخه‌های هر سه را بررسی می‌کند.
- category: `id, name, slug, state, created_at_utc`. product: `id, category_id, name, kind(GOOD|SERVICE), description, state, created_at_utc`. دو state فنی `DRAFT|PUBLISHED` هستند. index و check و FK برای اعتبار داده موجود است. **هیچ price، stock، seller، delivery یا اعتبار حمایتی از Catalog استنباط یا ذخیره نمی‌شود.**
- فقط GET عمومی قابل اجراست؛ **هیچ API انتشار یا درج عمومی وجود ندارد**. دادهٔ اولیه محصول/گروه در محیط shipping seed نمی‌شود.
- `GET /api/v1/catalog/categories`: فقط دسته‌های PUBLISHED، مرتب و با کلیدهای id/name/slug.
- `GET /api/v1/catalog/products?page=1&pageSize=20&categoryId=<uuid>&search=<text>`: فقط محصولات PUBLISHED با دستهٔ PUBLISHED، pagination پایدار با count واقعی، محدودیت ۱ تا ۵۰ برای تعداد صفحه، ۱ تا ۱۰۰۰۰ برای شماره صفحه، متن جست‌وجو تا ۸۰ نویسه و escape برای wildcardهای SQL LIKE. فقط id/categoryId/name/kind/description برمی‌گرداند.
- `GET /api/v1/catalog/products/{id}`: فقط محصول قابل‌نمایش را برمی‌گرداند؛ draft، محصول با دسته draft و ID ناشناخته 404 می‌گیرند. روی خطای DB یا پیکربندی، 503 برگشت داده می‌شود، نه فهرست خالی ساختگی. پاسخ‌ها `Cache-Control: no-store` دارند تا تغییر moderation بلافاصله اعمال شود.

## تست / مرز عملیاتی

تست CI فقط روی PostgreSQL موقت category/product تستی درج می‌کند و با API واقعی ASP.NET Core منتشرشده/مخفی، فیلتر، جزئیات، خاموش‌کردن دسته، صفحه‌بندی، ورودی نامعتبر، جست‌وجوی درصد literal و عدم نمایش price/seller/stock را تأیید می‌کند. **این‌ها داده و مسیر آزمایشی نیستند که در production در دسترس خریدار قرار گرفته باشند.**

خروجی این مرحله «هسته خواندن کاتالوگ» است، نه صفحه UI یا قابلیت خرید. برای مسیر خرید واقعی همچنان طرح‌های مصوب buyer home/list/detail، پنل مجاز moderation، داده معتبر Catalog، عرضه/قیمت/موجودی بر اساس فروشنده، پوشش شهر، quote و پرداخت لازم است. انتخاب SMS provider نیز برای ورود عملیاتی باقی است.
