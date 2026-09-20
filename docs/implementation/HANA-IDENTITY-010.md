# Identity 010 — اعتماد صریح به Reverse Proxy و Forwarded Headers

**دامنه:** بستن شکاف ثبت‌شده در Identity 009 برای تشخیص IP واقعی کلاینت و HTTPS پشت reverse proxy، بدون اعتماد به هدرهای ارسالی مستقیم کاربر. این مرحله provider پیامک انتخاب نمی‌کند، پیامک واقعی نمی‌فرستد و هیچ صفحهٔ فاقد طرح مصوب Figma را نهایی نمی‌کند.

## پیاده‌سازی

- تنظیمات جدید فقط با \`ReverseProxy:Enabled=true\` فعال می‌شوند. در این حالت \`ReverseProxy:TrustedAddresses\` اجباری است و فقط IP دقیق یا CIDR معتبر، جداشده با کاما/سمی‌کالن، پذیرفته می‌شود. پیکربندی خالی/خراب باعث **شکست startup** می‌شود؛ سامانه به حالت «اعتماد به همهٔ proxyها» fallback نمی‌کند.
- \`ForwardedHeadersMiddleware\` فقط \`X-Forwarded-For\` و \`X-Forwarded-Proto\` را پردازش می‌کند، \`ForwardLimit=1\` و \`RequireHeaderSymmetry=true\` دارد و لیست‌های پیش‌فرض trust پاک می‌شوند و با proxy/networkهای صریح پروژه جایگزین می‌شوند.
- middleware پیش از منطق هویت اجرا می‌شود؛ بنابراین \`HttpContext.Connection.RemoteIpAddress\` که Identity 009 برای بودجهٔ توزیع‌شده OTP هش می‌کند، فقط از proxy مورداعتماد قابل تغییر است. \`Request.IsHttps\` نیز فقط از همان مسیر برای TLS termination قابل بازیابی است.
- سوییچ عمومی \`ASPNETCORE_FORWARDEDHEADERS_ENABLED=true\` عمداً ممنوع و fail-fast شده است، چون می‌تواند trust list را دور بزند. استقرار باید topology واقعی load balancer/proxy را صریحاً در secrets/environment وارد کند.
- \`X-Forwarded-Host\` در این مرحله پردازش نمی‌شود؛ وب Next همچنان Origin/Host عمومی خودش را جداگانه بررسی می‌کند و API برای rate-limit/session فقط IP و scheme اصلی را نیاز دارد.

## آزمون

GitHub Actions در محیط Production سه مسیر را smoke می‌کند:

1. direct peer نامطمئن با \`X-Forwarded-For/X-Forwarded-Proto\` جعلی نمی‌تواند HTTP را HTTPS جا بزند؛ endpoint نشست 503 می‌ماند.
2. proxy صریحاً مورداعتماد روی loopback می‌تواند scheme اصلی HTTPS را منتقل کند؛ همان bearer نامعتبر پس از عبور از گیت HTTPS به 401 می‌رسد.
3. فعال‌سازی reverse proxy بدون trust list و نیز استفاده از سوییچ عمومی ناامن باید startup را متوقف کند.

این تست‌ها اثبات قرارداد forwarding و مرز اعتماد هستند؛ **ارسال SMS یا ورود واقعی کاربر را شبیه‌سازی و به‌عنوان قابلیت عملیاتی معرفی نمی‌کنند.**

## وضعیت انتشار و گام بعد

\`UnconfiguredOtpSmsSender\` همچنان پیش‌فرض است؛ شمارهٔ معتبر بدون provider واقعی 503 می‌گیرد و ورود عمومی فعال نیست. مرحلهٔ بعدی وابسته به تصمیم بیرونی است: انتخاب/قرارداد provider واقعی SMS و دریافت credential/قرارداد API. پس از مشخص‌شدن provider می‌توان adapter اختصاصی، idempotency/reconciliation وضعیت ارسال و E2E واقعی روی HTTPS/device را پیاده کرد. فریم نهایی OTP نیز باید از Figma مصوب بیاید.
