# ADR-051 — Independent Evaluation برای XGBoost Shadow

**وضعیت:** مصوب و لازم‌الاجرا  
**تاریخ ثبت:** ۲۰۲۶-۱۰-۰۷  
**حوزه:** Allocation Learning, XGBoost, Evaluation, Model Governance  
**مکمل:** [ADR-050 — XGBoost Learner v1 Offline Shadow](ADR-050-XGBOOST-V1-OFFLINE-SHADOW-LEARNER.md)

## تصمیم

- هر artifact مدل XGBoost v1 می‌تواند فقط با Labelهای مستقل از partition نوع `Evaluation` سنجیده شود.
- householdهای Evaluation نباید با householdهای frozen در Training Run هم‌پوشانی داشته باشند.
- Evaluation باید دقیقاً با lineage، dataset و funding instruction همان Training Run منطبق باشد.
- artifact پیش از ارزیابی با SHA-256 دوباره attest می‌شود؛ mismatch باید fail-closed باشد.
- benchmark فقط Baseline MSE، Shadow MSE و اختلاف آن‌ها را ثبت می‌کند.
- benchmark **winner انتخاب نمی‌کند، threshold موفقیت تعریف نمی‌کند، Proposal نمی‌سازد و Runtime را تغییر نمی‌دهد**.
- نتیجه benchmark append-only و idempotent است و باید به Training Run، artifact digest و Evaluation fingerprint قابل ردیابی باشد.

## مرز انتخاب مدل

دادهٔ benchmark برای تصمیم انسانی و مقایسهٔ مدل‌هاست. بهتر بودن یک metric به‌تنهایی مجوز Pilot یا Production نیست و هیچ activation خودکاری ایجاد نمی‌کند.
