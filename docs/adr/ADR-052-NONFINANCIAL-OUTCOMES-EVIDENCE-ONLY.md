# ADR-052 — Non-financial Outcomes فقط با Evidence معتبر

**وضعیت:** مصوب و لازم‌الاجرا  
**تاریخ ثبت:** ۲۰۲۶-۱۰-۰۷  
**حوزه:** Allocation Outcomes, Learning Data, Admin Operations

## تصمیم

- تا وقتی producer first-party و authoritative برای یک Outcome وجود ندارد، حنا نباید StockBarrier، DeliveryBarrier، AccessBarrier یا EssentialNeedsCoverage را از رفتار کاربر، خطای UI، نبود سفارش، quote ناقص یا دادهٔ مشابه حدس بزند.
- مسیر عملیاتی فعلی برای این Outcomeها **Human-reviewed + Evidence-backed** است.
- مقدار unknown باید null بماند. false و صفر فقط وقتی مجازند که بازبین انسانی همان مقدار را صریحاً مشاهده و ثبت کرده باشد.
- ثبت Outcome فقط روی snapshot first-party با lineage معتبر مجاز است.
- EventId بخشی از idempotency است؛ retry پس از نتیجه نامشخص باید دقیقاً با همان EventId و همان payload انجام شود.
- Outcome غیرمالی به‌تنهایی Need Label، eligibility، وزن تخصیص، Proposal، Pilot یا Runtime Activation ایجاد نمی‌کند.
- Producer خودکار فقط وقتی اضافه می‌شود که منبع authoritative واقعی داخل حنا وجود داشته باشد و قرارداد provenance مستقل آن تصویب شده باشد.

## وضعیت منابع فعلی

- Credit usage دارای producer اداری first-party است.
- Commerce فعلی برای StockBarrier، DeliveryBarrier و AccessBarrier هنوز یک event authoritative و قابل اتصال بدون ابهام به Allocation Snapshot فراهم نمی‌کند.
- بنابراین ساخت producer خودکار برای این سه مورد در این مرحله ممنوع است.
