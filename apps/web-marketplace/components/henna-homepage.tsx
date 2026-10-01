import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import HeroCarousel from "./hero-carousel";
import styles from "./henna-homepage.module.css";

const categories = [
  ["نان و شیرینی", "category-bread.png"],
  ["کنسرو و آماده", "category-canned.png"],
  ["بهداشتی و سلامت", "category-health.png"],
  ["میوه و صیفی", "category-produce.png"],
  ["روغن و خواربار", "category-grocery.png"],
  ["نوشیدنی‌ها", "category-drinks.png"],
  ["لبنیات محلی", "category-dairy.png"],
] as const;

const previewProducts: { title: string; detail: string; image: string; badge?: string; oldPrice?: string; price: string }[] = [
  { title: "پنیر سفید ایرانی ممتاز", detail: "۴۰۰ گرم - لبنیات هراز", image: "product-1.png", badge: "ویژه کالابرگ", oldPrice: "۶۵,۰۰۰", price: "۵۴,۰۰۰" },
  { title: "ماست سون همزده پرچرب", detail: "۹۰۰ گرم - کاله", image: "product-2.png", badge: "تخفیف ویژه", price: "۴۸,۵۰۰" },
  { title: "برنج هاشمی درجه یک", detail: "۵ کیلوگرم - کشتزار شمال", image: "product-3.png", badge: "طرح حمایتی", oldPrice: "۷۲۰,۰۰۰", price: "۶۴۰,۰۰۰" },
  { title: "روغن آفتابگردان خالص", detail: "۱.۵ لیتر - لادن", image: "product-4.png", price: "۸۹,۰۰۰" },
  { title: "چای سیاه ارگانیک لاهیجان", detail: "۴۵۰ گرم - ممتاز باروتی", image: "product-5.png", badge: "تخفیف ویژه", oldPrice: "۱۴۵,۰۰۰", price: "۱۲۸,۰۰۰" },
] as const;

const steps = [
  ["انتخاب آزادانه کالاها", "کالاها، لبنیات، نان روزانه، تخفیف‌ها یا اقلام کالابرگی مورد نیاز خود را مستقیماً جست‌وجو کرده و بدون محدودیت به سبد خریدتان اضافه کنید.", "۱"],
  ["مقایسه فروشگاه‌های نزدیک", "حنا فروشگاه‌های محله تا شعاع ۵ کیلومتری را بر اساس کمترین قیمت کل، درصد موجودی اقلام سبد و زمان تحویل با هم مقایسه و پیشنهاد می‌کند.", "۲"],
  ["ثبت سفارش از بهترین گزینه", "سفارش شما در کمتر از ۳۰ دقیقه مستقیماً توسط پیک ارسال شده و سهم حمایت اجتماعی خریدتان در لحظه ثبت می‌شود.", "۳"],
] as const;

const accountFeatures = [
  ["خرید شخصی و روزانه", "به عنوان یک کاربر حقیقی به تمام اقلام سوپرمارکتی دسترسی دارید؛ با بهترین قیمت سبد خرید روزمره‌تان را تامین و تحویل فوری بگیرید.", "bag"],
  ["مشارکت اجتماعی فعال", "سفارش‌های حقوقی سازمان‌ها یا مسئولیت‌های اجتماعی شخصی خود را با تضمین قیمت کف و تخصیص مستقیم سهم توسعه محلی ثبت کنید.", "heart"],
  ["دریافت اعتبار حمایتی", "اگر واجد شرایط طرح‌های حمایتی دولتی یا سازمانی هستید، می‌توانید اعتبار دریافتی خود را بلافاصله در همان حساب فعال و خرج اقلام سبد کنید.", "award"],
] as const;

export default function HennaHomepage() {
  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.announcement}>🎉 طرح جدید کالابرگ حنا فعال شد؛ خریدی هوشمندانه با بیشترین حمایت اجتماعی</div>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart"><span className={styles.cartCount}>۰</span> سبد خرید <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2.2 11h10.7L20 8H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></svg></Link>
            <Link className={styles.login} href="/auth">ورود یا ثبت‌نام <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c.5-4 2.8-6 7-6s6.5 2 7 6"/></svg></Link>
            <span className={styles.divider} />
            <Link className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <form className={styles.search} action="/products">
            <input name="q" placeholder="جست‌وجوی نان، لبنیات، برنج و اقلام روزانه..." aria-label="جست‌وجو در کالاها" />
            <button aria-label="جست‌وجو"><svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg></button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          <Link href="/products">همه‌ دسته‌ها</Link><Link href="/products">میوه و سبزیجات</Link><Link href="/products">نوشیدنی‌ها</Link><Link href="/products">خواربار و نان</Link><Link href="/products">لبنیات و تخم مرغ</Link><Link href="/products">طرح‌های ویژه حنا</Link><Link href="/products">کالابرگ الکترونیکی</Link><Link href="/products">تخفیف‌های طلایی</Link>
        </nav>
      </header>

      <div className={styles.shoppingArea}>
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="home-title">
          <HeroCarousel />
        </section>

        <div className={`${styles.container} ${styles.promoGrid}`}>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoTerracotta}`}><span className={styles.promoTitle}><strong>تخفیف‌دارهای روزانه</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/percent.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>محبوب‌ترین کالاهای سبد خرید روزانه شما با قیمت‌های استثنایی و فرصت‌های خرید تکرارنشدنی</span><span className={styles.promoMore}>لیست تخفیف‌ها ←</span></Link>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoBeige}`}><span className={styles.promoTitle}><strong>کالابرگ الکترونیک</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/credit-card.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>امکان پرداخت سهم یارانه‌ای با استفاده از کارت‌های معتبر حمایتی برای اقلام اساسی مصوب</span><span className={styles.promoMore}>استفاده از کالابرگ ←</span></Link>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoGreen}`}><span className={styles.promoTitle}><strong>طرح‌های ویژه حنا</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/gift.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>بسته‌ها و فرصت‌های خرید اشتراکی خانواده و محله با مشارکت مستقیم فروشگاه‌های منتخب</span><span className={styles.promoMore}>مشاهده طرح‌ها ←</span></Link>
        </div>

        <section className={`${styles.container} ${styles.categories}`} id="categories">
          <div className={styles.sectionHeading}><h2>دسته‌بندی‌های محبوب</h2><Link href="/products">مشاهده همه دسته‌ها</Link></div>
          <div className={styles.categoryGrid}>{categories.map(([label, image]) => <Link className={styles.category} href="/products" key={label}><span><Image src={`/landing/${image}`} alt="" width={100} height={100} /></span><strong>{label}</strong></Link>)}</div>
        </section>

        <section className={`${styles.container} ${styles.offers}`} id="offers">
          <div className={styles.sectionHeading}><h2>پیشنهادهای امروز</h2><Link href="/products">مشاهده همه محصولات</Link></div>
          <p className={styles.previewNotice}>اطلاعات قیمت و کالا در این بخش نمونهٔ طراحی فیگماست؛ برای موجودی واقعی به کاتالوگ مراجعه کنید.</p>
          <div className={styles.productGrid}>
            {previewProducts.map((product) => (
              <article className={styles.productCard} key={product.title}>
                <div className={styles.productImage}>
                  <Image src={`/landing/${product.image}`} alt={product.title} width={400} height={300} />
                  {product.badge && <span>{product.badge}</span>}
                </div>
                <div className={styles.productInfo}>
                  <h3>{product.title}</h3>
                  <p>{product.detail}</p>
                </div>
                <div className={styles.productAction}>
                  <Link href="/products" className={styles.addButton}>افزودن +</Link>
                  <div className={styles.productPrice}>
                    {product.oldPrice && <del>{product.oldPrice}</del>}
                    <strong><span>{product.price}</span> <small>تومان</small></strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.steps} id="how-it-works"><div className={styles.container}><div className={styles.centerHeading}><h2>چرا خرید از حنا هوشمندانه‌تر است؟</h2><p>فرآیند خرید و مقایسه بدون انتخاب پیش‌فرض فروشگاه</p></div><div className={styles.stepsGrid}>{steps.map(([title, body, number], index) => <Fragment key={number}><div><span>{number}</span><h3>{title}</h3><p>{body}</p></div>{index < steps.length - 1 && <b aria-hidden="true">←</b>}</Fragment>)}</div></div></section>

      <section className={styles.impact} id="impact"><div className={`${styles.container} ${styles.impactInner}`}><Image src="/landing/impact.png" alt="فروشنده محلی در فروشگاه مواد غذایی" width={800} height={520} /><div><span className={styles.eyebrow}>ارزش اجتماعی و توسعه محلی</span><h2>خریدی که اثرش ادامه پیدا می‌کند</h2><p>ما در حنا معتقدیم خرید روزمره می‌تواند فراتر از تامین نیازهای مصرفی باشد. با اتصال مستقیم شما به سوپرمارکت‌ها و فروشگاه‌های محله خودتان، نه‌تنها اقتصاد کسب‌وکارهای کوچک محلی تقویت می‌شود، بلکه سهمی از درآمد هر خرید صرف صندوق حمایت ازمحرومان واجد شرایط یا توانمندسازی خانواده‌های محلی می‌شود. همه‌چیز شفاف، انسانی و بدون هزینه اضافی برای شماست.</p><div className={styles.stats}><div><strong>۱۲,۸۰۰+</strong><span>خانواده تحت پوشش حمایتی</span></div><div><strong>۳,۴۰۰+</strong><span>فروشگاه محلی فعال</span></div></div></div></div></section>

      <section className={styles.benefits} id="benefits"><div className={styles.container}><div className={styles.centerHeading}><h2>یک حساب، چند امکان</h2><p>تمام نیازهای خرید روزانه و حمایت‌های سازمانی یا حاکمیتی در یک درگاه امن</p></div><div className={styles.benefitGrid}>{accountFeatures.map(([title, body, icon]) => <article className={styles.benefitCard} key={icon}><span aria-hidden="true"><Image src={`/landing/icons/${icon === "bag" ? "shopping-bag" : icon === "heart" ? "heart" : "award"}.svg`} alt="" width={24} height={24} /></span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

      <section className={styles.finalCta} aria-labelledby="final-cta-title"><div className={styles.ctaOverlay}><div className={styles.ctaContent}><h2 id="final-cta-title">حنا؛ بازارگاه گرم و عادلانه محله شما</h2><p>همین حالا اولین سبد خرید خود را پر کنید و هوشمندترین مقایسه قیمت را در محله خود تجربه کنید. با هر خرید، لبخندی بر لبان فروشندگان کوچک محله بنشانید.</p><div className={styles.ctaButtons}><Link href="/seller/register" className={styles.ctaSecondary}>ثبت‌نام فروشگاه‌ها و تامین‌کنندگان</Link><Link href="/products" className={styles.primaryButton}>شروع پر کردن سبد خرید</Link></div></div></div></section>

      <footer className={styles.footer} id="footer">
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerSupport}><h3>طرح‌های حمایتی</h3><Link href="/products">ثبت‌نام کالابرگ</Link><Link href="/products">اعتبارات سازمانی</Link><Link href="/products">کارت‌های معیشتی</Link><a href="#benefits">گزارش شفافیت مالی</a></div>
          <div><h3>همکاری با حنا</h3><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/seller/register">شرایط همکاری پیک‌ها</Link><Link href="/seller/register">فرصت‌های شغلی</Link></div>
          <div><h3>دسترسی سریع</h3><a href="#how-it-works">سوالات متداول</a><a href="#footer">قوانین و مقررات</a><a href="#impact">درباره حنا</a><Link href="/auth">تماس با پشتیبانی</Link></div>
          <div className={styles.footerBrand}><Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized /><p dir="rtl">حنا اولین بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p></div>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`}><span>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است. کلیه حقوق برای حنا محفوظ است.</span><div><a href="#footer" aria-label="اینستاگرام حنا"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor"/></svg></a><a href="#footer" aria-label="توییتر حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.6 6.4 21H3.2l7.3-8.4L2.8 3h6.4l4.5 5.9L18.9 3Zm-1.1 16h1.7L8.2 4.9H6.4L17.8 19Z"/></svg></a><a href="#footer" aria-label="لینکدین حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.2 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.6 9h3.2v11H3.6V9Zm5.3 0H12v1.5h.1a3.6 3.6 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.2V20h-3.3v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20H8.9V9Z"/></svg></a></div></div>
      </footer>
    </main>
  );
}
