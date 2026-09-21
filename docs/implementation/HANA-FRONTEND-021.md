# Frontend 021 — CI شبیه‌ساز واقعی Android برای تحویل URI اختصاصی خریدار

## دلیل و دامنه

Frontend 020 parser، warm/cold coordinator و خروجی Android JS را آزموده بود، اما هیچ APK native نصب‌شده‌ای برای اثبات اتصال **سیستم‌عامل Android → intent-filter → React Native Linking → صفحهٔ مصوب خریدار** تست نمی‌شد. این مرحله هیچ صفحه/گزینه/فیلد تازه‌ای به UI shipping اضافه نمی‌کند و تأیید Figma چهار فریم مرور و شش فریم جزئیات قبلی را به مسیر تست واقعی وصل می‌کند.

## شیوهٔ بازتولید CI

در `.github/workflows/bootstrap.yml`، job جدا `android-native-links`:
1. monorepo را با Node 22 و JDK 17 نصب می‌کند؛ پروژهٔ Android را از `apps/mobile-consumer/app.json` با `npx expo prebuild --platform android --no-install` به‌شکل ephemeral تولید می‌کند.
2. `./gradlew :app:assembleRelease --no-daemon` با JS embedded یک APK نصب‌پذیر **CI-only با امضای محلی/آزمایشی** می‌سازد. این build برای انتشار فروشگاهی، امضای production، کانال EAS یا iOS نیست. اپ هیچ پیکربندی API واقعی یا دادهٔ seed ندارد.
3. `reactivecircus/android-emulator-runner@v2` روی Android API 35 (Google APIs, x86_64) emulator سخت‌افزارشتاب راه می‌اندازد، APK را با `adb install` نصب می‌کند و با `am start -a VIEW -d hana://...` **بدون تعیین اجباری component/package** مسیر OS intent را آزمایش می‌کند. قبل از launch، `cmd package resolve-activity` خود URI ثبت‌شده برای package واقعی داخل APK را بررسی می‌کند.
4. `tests/mobile-android-native-smoke.py` درخت accessibility واقعی نمایش را از `uiautomator dump` می‌خواند؛ OCR، screenshot حدسی و تست با Expo Go در کار نیست. با cold detail عمومی، پیام unavailable (چون API عمداً تنظیم نشده)، Android Back و بازگشت به جست‌وجوی URI، لینک گرم detail/browse، نادیده‌گرفتن لینک خارج از scope و cold browse با متن فارسی سنجیده می‌شود.

بدون API production، صفحهٔ جزئیات باید اختلال دریافت را صادقانه نشان دهد؛ نه ۴۰۴ ساختگی و نه کالای نمونه. شواهد `200`/۴۰۴/۵۰۳ و race روی API در CI قبلی وب و کلاینت موبایل باقی می‌ماند. `android-native-links` نیز مانند سه job قبلی برای PR و push به main گیت است.

## محدودیت‌های دقیق

در زمان Frontend 021 این پوشش صرفاً تحویل intent و UI native **در emulator Android CI** را اثبات می‌کرد؛ [Frontend 022](HANA-FRONTEND-022.md) بعداً CI نصب‌شده در شبیه‌ساز iOS را به آن افزود. این دو آزمون هنوز کیفیت بصری و لمس کامل روی سخت‌افزار واقعی یا نسخهٔ store-signed را اثبات نمی‌کنند. Universal/Verified HTTPS App Links برای دامنهٔ production، associationهای Android و iOS، setup signing واقعی، iOS simulator/test و تست فیزیکی همچنان جداگانه هستند. این PR پیامک، فروشندهٔ تأییدشده، کالاهای واقعی production، قیمت، موجودی، خرید یا پرداخت نمی‌سازد.
