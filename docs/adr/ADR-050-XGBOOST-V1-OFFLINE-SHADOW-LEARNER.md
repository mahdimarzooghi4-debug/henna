# ADR-050 — XGBoost Learner v1 به‌صورت Offline Shadow در حنا

**وضعیت:** مصوب مالک محصول  
**تاریخ ثبت:** ۲۰۲۶-۱۰-۰۷  
**حوزه:** Allocation Learning, Internal AI, Training, Model Artifacts  
**مکمل:** [ADR-048 — هوش مصنوعی داخلی حنا و منع Model API](ADR-048-HENNA-OWNED-AI-NO-MODEL-API.md)

## تصمیم

- XGBoost مدل یادگیرندهٔ v1 حنا برای شروع یادگیری از داده‌های واقعی و بازبینی‌شده است.
- در این مرحله XGBoost فقط Offline Shadow Learner است: روی همان cohort مجاز Training/Validation آموزش می‌بیند، اما خودش Proposal، Eligibility، Allocation، Wallet، Payment یا Runtime Activation ایجاد نمی‌کند.
- فقط دادهٔ first-party حنا با Reviewed Label و lineage معتبر وارد آموزش می‌شود. Evaluation partition هرگز وارد training یا validation-selection این مدل نمی‌شود.
- artifact مدل در هر Training Run به‌صورت JSON باینری ذخیره و با SHA-256 attest می‌شود. hyperparameters و train/validation metrics نیز همراه همان run ثبت می‌شوند.
- مسیر فعلی ExperimentalAllocationWeightLearner → Proposal → Human Review → Pilot → Explicit Runtime Promotion تا زمانی که قرارداد runtime مدل درختی مستقلاً تصویب شود تغییر نمی‌کند.
- feature importance یا SHAP به‌طور خودکار به وزن تخصیص تبدیل نمی‌شود؛ چنین تبدیل ضمنی یک قرارداد محصول جدید خواهد بود و فعلاً ممنوع است.
- XGBoost v1 به‌معنای انتخاب قطعی مدل نهایی Production نیست. انتخاب نهایی همچنان باید با benchmark روی دادهٔ واقعی کافی انجام شود.

## پیکربندی فنی v1

این‌ها پارامترهای engineering-versioned مدل هستند، نه threshold محصول:

- CPU only
- booster=gbtree
- objective=reg:squarederror
- tree_method=hist
- n_estimators=100
- max_depth=3
- learning_rate=0.1
- subsample=1
- colsample_bytree=1
- reg_lambda=1
- seed=0
- nthread=1

Validation فقط برای سنجش held-out استفاده می‌شود و hyperparameter search خودکار در این نسخه انجام نمی‌شود.

## مرز Production

وجود artifact، بهتر بودن metric یا موفقیت Training Run به‌تنهایی هیچ Production effect ندارد. هر تغییر آینده در runtime مدل XGBoost باید قرارداد مستقل، Evaluation، Human Review، Controlled Pilot و Explicit Runtime Promotion داشته باشد.
