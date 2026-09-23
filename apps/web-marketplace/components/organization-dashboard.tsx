export function OrganizationDashboard() {
  const cards = [
    { title: "وضعیت همگام‌سازی افراد", value: "فعال و متصل", text: "دریافت افراد از منبع داده سازمان" },
    { title: "وضعیت آخرین تخصیص", value: "فعال", text: "الگوی تخصیص حنا" },
    { title: "طرح‌های فعال و ثبت‌شده", value: "۳ طرح", text: "طرح نمونه، برنامه ارتقای سلامت پرسنل" },
    { title: "فعالیت‌های اخیر پرتال", value: "۳ رویداد", text: "همگام‌سازی و تغییر وضعیت طرح‌ها" },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f3ed] p-6 text-[#2d2d2d]">
      <header className="mb-6 rounded-xl border border-[#d7b895] bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">داشبورد پرتال سازمانی</h1>
          <span className="rounded-md bg-[#d7b895] px-3 py-1 text-sm">سازمان حمایتگر</span>
        </div>
      </header>

      <section className="mb-6 rounded-xl border border-[#0f5b5a] bg-white p-5 text-right">
        <h2 className="font-bold text-[#0f5b5a]">سازمان حمایتگر | روش تخصیص: الگوی حنا</h2>
        <p className="mt-2 text-sm">تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود.</p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border border-[#d7b895] bg-white p-5 text-right">
            <h2 className="mb-4 text-lg font-bold">{card.title}</h2>
            <p className="font-semibold">{card.value}</p>
            <p className="mt-2 text-sm">{card.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
