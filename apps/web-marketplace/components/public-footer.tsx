import Link from "next/link";

export function PublicFooter(){
 return <footer className="public-footer" dir="rtl">
  <nav aria-label="اطلاعات عمومی حنا">
   <Link href="/faq">پرسش‌های متداول</Link>
   <Link href="/terms">شرایط استفاده</Link>
   <Link href="/privacy">حریم خصوصی</Link>
   <Link href="/contact">تماس با حنا</Link>
  </nav>
 </footer>;
}
