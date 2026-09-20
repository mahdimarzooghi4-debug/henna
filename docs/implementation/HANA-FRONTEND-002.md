# فرانت‌اند ۰۰۲ — آغاز اپ موبایل مصرف‌کننده از فیگمای حنا

**وضعیت:** اولین اپ React Native / Expo قابل توسعه با صفحه ورود بصری و تعامل محلی؛ هنوز اتصال OTP، احراز هویت، صفحه خانه، ثبت‌نام فروشگاه یا انتشار فروشگاهی ندارد.

## مرجع طراحی

- [فریم «Hana App • Auth — Rebuild» / گره 160:58](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=160-58): طراحی مرجع موبایل خریدار با قاب ۳۹۰×۸۴۴ و چینش RTL؛ لوگو، برگشت، تیتر، ورودی شماره، دکمه دریافت کد، توضیح حساب و پیوند راهنمای ثبت‌نام فروشگاه.
- [Foundations / گره 8:4](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=8-4): پالت در `src/theme.ts` هم‌راستا با متغیرهای CSS وب نگهداری می‌شود.
- لوگوی گره `160:59` و نشان برگشت گره `160:60` **عین asset استخراج‌شده از فیگما** و به‌صورت PNG محلی commit شدند؛ وابستگی دائمی به URL موقت Figma نداریم.

## فناوری، مرز دامنه و اجرا

- `apps/mobile-consumer`: Expo SDK 57، React Native 0.86، React 19.2.3 و TypeScript. React وب به 19.2.3 همگام شد تا monorepo با npm workspace سازگار بماند. این نسخه‌ها برای این گام قفل شده‌اند تا Metro و TypeScript روی CI بررسی شوند.
- اپ صرفاً **برای مصرف‌کننده** است؛ فریم `160:111` طبق تصمیم دامنه **OUT OF SCOPE** و ثبت‌نام فروشگاه در وب باقی می‌ماند. دکمه متنی «ثبت‌نام فروشگاه» روی موبایل فعلاً توضیح می‌دهد این کار در وب انجام می‌شود؛ لینک دامنه تولید یا جریان تأییدشده جعل نشده است.
- `App.tsx` با `SafeAreaView`، `ScrollView`، `KeyboardAvoidingView`، `TextInput` و `Pressable` طراحی موبایل را اجرا می‌کند؛ بدون HTML/CSS وب و بدون انتقال کد Tailwind فیگما به اپ. تایپوگرافی نهایی Vazirmatn به تأمین فایل فونت دارای مجوز و بررسی روی دستگاه نیاز دارد.
- اعتبارسنجی محلی شماره موبایل ایرانی با ارقام فارسی/عربی انجام می‌شود؛ **OTP ارسال، کاربر واردشده، نشست یا حساب واقعی ایجاد نمی‌شود**. برای ورودی معتبر پیام عدم اتصال دیده می‌شود. نشان برگشت تا ساخت صفحه خانه فقط علت عدم امکان بازگشت را اعلام می‌کند، نه اینکه ناوبری جعلی انجام دهد.
- API بک‌اند .NET، سرویس پیامک، اپ‌استور، EAS و گواهی‌های امضا هنوز پیکربندی نشده‌اند؛ مجوز، URL سامانه تولید و شناسه اپ نهایی بعداً تعیین شود.

## دستورات توسعه

```sh
npm install
npm run mobile:typecheck
npm run mobile:dev
# برای بررسی بسته‌بندی باندل Android بدون ساخت APK:
npm run mobile:export:android
```

## معیار اعتبارسنجی گام

در `.github/workflows/bootstrap.yml` یک job موبایل برای `expo install --check`، typecheck و export باندل Android افزوده شد. **این خروجی APK/IPA یا تست نصب روی دستگاه نیست**؛ در [اجرای موفق CI برای commit `4ff5673`](https://github.com/mahdimarzooghi4-debug/henna/actions/runs/35513570904)، jobهای **mobile / web / backend هر سه موفق شدند**، شامل `expo install --check`، typecheck موبایل و export باندل Android. این موفقیت ادعای تست نصب روی دستگاه یا دسترس‌پذیری API احراز هویت نیست. آزمایش بصری روی Android/iOS و فونت نهایی در گام بعد لازم است.

## اصلاح سازگاری وابستگی‌ها

نخستین `expo install --check` در CI ناسازگاری نسخه‌ای react-native، نوع‌های React و TypeScript را گزارش کرد. آنها با نسخه‌های مورد انتظار Expo SDK 57 (React Native 0.86.3، `@types/react ~19.2.4` و TypeScript `~6.0.3` برای اپ) هماهنگ شدند؛ ابزار TypeScript وب جداگانه در نسخه 5.9 باقی ماند. وضعیت build/export باید پس از اجرای مجدد CI بررسی شود.
