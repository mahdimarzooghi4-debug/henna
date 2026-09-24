# Frontend 031 — Complete Organization Portal UI

## Scope

ادامه مستقیم Frontend 030 و پیاده‌سازی مجموعه کامل صفحه Figma `06 • Organization Portal`.

مرجع طراحی:
- Figma page `386:2`
- 15 frame از `ORGPORTAL / 01 Dashboard` تا `ORGPORTAL / 15 Settings`

## اجرا

یک shell مشترک برای پرتال سازمانی ساخته شد تا header، sidebar، هویت حنا و رفتار responsive در همه صفحات یکسان بماند. مسیرهای وب:

- `/organization`
- `/organization/profile`
- `/organization/programs`
- `/organization/programs/detail`
- `/organization/programs/new`
- `/organization/people`
- `/organization/people/add`
- `/organization/data-sources`
- `/organization/allocation`
- `/organization/allocation/detail`
- `/organization/usage`
- `/organization/reports`
- `/organization/notifications`
- `/organization/support`
- `/organization/settings`

## مرز داده

این مرحله **UI implementation** است. تمام مقادیر «نمونه» دقیقاً از خود Figma آمده‌اند و نباید به عنوان داده production تفسیر شوند. اتصال واقعی سازمان، همگام‌سازی، تخصیص، گزارش و تیکت پشتیبانی نیازمند قرارداد API و backend جداگانه است.

## کیفیت

- ناوبری داخلی واقعی با Next Link
- RTL و responsive reflow
- جدول‌ها با overflow امن در موبایل
- فرم‌های قابل تعامل در سطح HTML بدون جعل عملیات backend
- smoke test برای قرارداد 15 صفحه و shell مشترک
