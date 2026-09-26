# Catalog 006 — رسانهٔ محصول با بازبینی اپراتور

## نتیجه

هویت محصول در Catalog می‌تواند یک تصویر اصلیِ واقعی و تأییدشده داشته باشد. فایل با شناسهٔ asset داخلی نگهداری می‌شود؛ seller نه تصویر upload می‌کند و نه URL دلخواه تعیین می‌کند. این گام Admin UI نمی‌سازد چون Figma مصوب برای بازبینی Admin موجود نیست.

## قرارداد و API

- فایل در object storage سازگار با S3 و با bucket خصوصی ذخیره می‌شود. endpoint، region، bucket و credentials فقط از تنظیمات محیطی `CatalogMedia` خوانده می‌شوند؛ هیچ credential یا provider خاصی در کد/نمونه‌تنظیمات ثبت نشده است.
- فقط Admin که نشست معتبر و نقش فعلی‌اش در Identity DB برابر `ADMIN` است، می‌تواند تصویر را بارگذاری یا بازبینی کند.
- بارگذاری می‌پذیرد: JPEG، PNG یا WebP با سقف 5 MiB؛ بایت‌ها از روی signature تشخیص داده می‌شوند، سپس SHA-256 ثبت می‌شود. SVG و URL خارجی پذیرفته نمی‌شوند.
- `POST /api/v1/admin/catalog/products/{productId}/media` بارگذاری را در حالت `PENDING_REVIEW` ثبت می‌کند؛ `Idempotency-Key` در هر Admin یکتا است.
- `POST /api/v1/admin/catalog/media/{assetId}/review` با revision دقیق، تصمیم `APPROVED` یا `REJECTED` و `Idempotency-Key` وضعیت را تغییر می‌دهد. دلیل رد اجباری است؛ رخداد تصمیم در `catalog.media_reviews` افزایشی/immutable است.
- تصمیم تأیید، asset را به‌عنوان تصویر اصلی محصول وصل می‌کند. عملیات وضعیت و audit در یک تراکنش انجام می‌شوند.
- `GET /api/v1/catalog/media/{assetId}` فقط تصویر تأییدشدهٔ متصل به محصول منتشرشده در دستهٔ منتشرشده را برمی‌گرداند؛ پاسخ دارای `no-store` و `nosniff` است و checksum از مخزن دوباره کنترل می‌شود.
- پاسخ‌های عمومی Catalog فقط `imageUrl` نسبی و فقط وقتی محصول به asset اصلی متصل است، برمی‌گردانند. کلید bucket یا object به client افشا نمی‌شود.
- upload و review بدون پیکربندی database/storage در دسترس نیستند. انتخاب حساب میزبانی، region، bucket lifecycle و تأمین secret برای Stage/Production کار عملیاتی جداگانه است.

## داده و مرزها

Migration جدید هیچ تصویر، URL یا رکورد ساختگی ایجاد نمی‌کند. فراداده در `catalog.media_assets` نگهداری می‌شود و سابقهٔ تصمیم در `catalog.media_reviews` جداست. شناسهٔ عامل‌ها ذخیره می‌شود، اما جدول Identity به مدل EF کاتالوگ وابسته نشده است؛ نقش Admin هنگام هر درخواست از Identity DB حل می‌شود.

Seller Offer، قیمت، موجودی، نمایش seller، Admin UI، thumbnail/variant generation و lifecycle خودکار objectها خارج از این برش‌اند. تأیید asset نیز به‌تنهایی محصول را منتشر نمی‌کند.

## آزمون

تست integration با PostgreSQL و API مسیرهای anonymous/غیر Admin/Admin، upload و review تکراری، asset پنهان تا تأیید، revision کهنه، ثبت audit، checksum و انتشار محصول را بررسی می‌کند. چهار gate CI مورد استفاده: backend، web، mobile و Android؛ iOS خارج از دامنه است.
