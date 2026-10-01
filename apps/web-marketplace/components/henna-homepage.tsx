import Image from "next/image";
import Link from "next/link";
import styles from "./henna-homepage.module.css";

const categories = [
  ["نان و شیرینی", "hero.webp"],
  ["کنسرو و آماده", "category-spices.webp"],
  ["بهداشت و سلامت", "category-health.webp"],
  ["میوه و صیفی", "category-produce.webp"],
  ["روغن و خواربار", "product-4.webp"],
  ["نوشیدنی‌ها", "product-5.webp"],
  ["لبنیات محلی", "product-2.webp"],
] as const;

const previewProducts = [
  ["پنیر سفید ایرانی", "product-1.webp"],
  ["ماست تازه", "product-2.webp"],
  ["برنج ایرانی", "product-3.webp"],
  ["روغن آفتابگردان", "product-4.webp"],
  ["چای ایرانی", "product-5.webp"],
] as const;

const benefits = [
  ["خرید روزانه آسان", "کالاهای موردنیازتان را در یک سبد جمع کنید و پیشنهاد فروشگاه‌های نزدیک را ببینید.", "۱"],
  ["تقویت فروشگاه‌های محلی", "خرید از فروشگاه‌های محله به رونق کسب‌وکارهای محلی کمک می‌کند.", "۲"],
  ["اثر اجتماعی خرید", "حنا خرید روزمره را به فرصتی برای مشارکت اجتماعی و توسعه محلی پیوند می‌دهد.", "۳"],
] as const;

export default function HennaHomepage() {
  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.announcement}>🎉 طرح جدید کالابرگ حنا؛ خریدی هوشمندانه با بیشترین حمایت اجتماعی</div>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart"><span className={styles.cartCount}>۰</span> سبد خرید <span aria-hidden="true">🛒</span></Link>
            <Link className={styles.login} href="/auth">ورود یا ثبت‌نام <span aria-hidden="true">♙</span></Link>
            <span className={styles.divider} />
            <Link className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={220} height={72} priority />
          </Link>
          <form className={styles.search} action="/products">
            <input name="q" placeholder="جست‌وجوی نان، لبنیات، برنج و اقلام روزانه..." aria-label="جست‌وجو در کالاها" />
            <button aria-label="جست‌وجو">⌕</button>
          </form>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          <Link href="/products">همه دسته‌ها</Link><Link href="/products">میوه و سبزیجات</Link><Link href="/products">خواربار و نان</Link><Link href="/products">لبنیات و تخم‌مرغ</Link><Link href="/products">نوشیدنی‌ها</Link><Link href="/products">پیشنهادها</Link><a href="#impact">درباره حنا</a>
        </nav>
      </header>

      <div className={styles.shoppingArea}>
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>همراه با ارزش‌آفرینی محلی و اجتماعی</span>
            <h1 id="home-title">خرید روزمره،<br />با اثری فراتر از خرید</h1>
            <p>در حنا کالاها، تخفیف‌ها و اقلام کالابرگ را انتخاب کنید و سبد خریدتان را کامل کنید. حنا فروشگاه‌های نزدیک را از نظر قیمت، موجودی و سرعت ارسال مقایسه می‌کند تا انتخاب بهتری داشته باشید.</p>
            <div className={styles.heroButtons}><Link className={styles.primaryButton} href="/products">شروع خرید روزانه</Link><a className={styles.secondaryButton} href="#offers">مشاهده پیشنهادها</a></div>
          </div>
          <div className={styles.heroVisual}>
            <Image src="/landing/hero.webp" alt="سفره‌ای از نان و خوراکی‌های محلی" fill priority sizes="(max-width: 640px) 100vw, 50vw" />
            <div className={styles.heroCaption}><strong>سبد خود را با محصولات تازه و محلی کامل کنید</strong><span>پیشنهادهای فروشگاه‌های اطراف را بررسی کنید.</span></div>
          </div>
        </section>

        <div className={`${styles.container} ${styles.promoGrid}`}>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoTerracotta}`}><span className={styles.promoIcon} aria-hidden="true">٪</span><span className={styles.promoCopy}><strong>تخفیف‌دارهای روزانه</strong><span>پیشنهادهای خرید روزانه را در کاتالوگ حنا ببینید.</span><span className={styles.promoMore}>دیدن کالاها ←</span></span></Link>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoBeige}`}><span className={styles.promoIcon} aria-hidden="true">▣</span><span className={styles.promoCopy}><strong>کالابرگ الکترونیک</strong><span>اقلام کالابرگ را در سبد خریدتان پیدا کنید.</span><span className={styles.promoMore}>مشاهده اقلام ←</span></span></Link>
          <Link href="/products" className={`${styles.promoCard} ${styles.promoGreen}`}><span className={styles.promoIcon} aria-hidden="true">✦</span><span className={styles.promoCopy}><strong>طرح‌های ویژه حنا</strong><span>طرح‌های خرید خانواده و محله را دنبال کنید.</span><span className={styles.promoMore}>مشاهده طرح‌ها ←</span></span></Link>
        </div>

        <section className={`${styles.container} ${styles.categories}`} id="categories">
          <div className={styles.sectionHeading}><h2>دسته‌بندی‌های محبوب</h2><Link href="/products">مشاهده همه دسته‌ها</Link></div>
          <div className={styles.categoryGrid}>{categories.map(([label, image]) => <Link className={styles.category} href="/products" key={label}><span><Image src={`/landing/${image}`} alt="" width={100} height={100} /></span><strong>{label}</strong></Link>)}</div>
        </section>

        <section className={`${styles.container} ${styles.offers}`} id="offers">
          <div className={styles.sectionHeading}><h2>کالاهای منتخب حنا</h2><Link href="/products">رفتن به کاتالوگ</Link></div>
          <p className={styles.previewNotice}>تصاویر زیر پیش‌نمایش طراحی هستند؛ کالا و قیمت قابل خرید پس از انتشار در کاتالوگ نمایش داده می‌شود.</p>
          <div className={styles.productGrid}>{previewProducts.map(([title, image]) => <article className={styles.productCard} key={title}><div className={styles.productImage}><Image src={`/landing/${image}`} alt={title} width={400} height={300} /><span>پیش‌نمایش</span></div><h3>{title}</h3><p>اطلاعات فروش و قیمت در کاتالوگ</p><Link href="/products" className={styles.addButton}>مشاهده کاتالوگ</Link></article>)}</div>
        </section>
      </div>

      <section className={styles.steps} id="how-it-works"><div className={styles.container}><div className={styles.centerHeading}><h2>چرا خرید از حنا هوشمندانه‌تر است؟</h2><p>از انتخاب کالا تا مقایسه فروشگاه‌های نزدیک</p></div><div className={styles.stepsGrid}>{benefits.map(([title, body, number], index) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></div>)}</div></div></section>

      <section className={styles.impact} id="impact"><div className={`${styles.container} ${styles.impactInner}`}><Image src="/landing/impact.webp" alt="فروشنده محلی در فروشگاه مواد غذایی" width={800} height={520} /><div><span className={styles.eyebrow}>ارزش اجتماعی و توسعه محلی</span><h2>خریدی که اثرش ادامه پیدا می‌کند</h2><p>حنا خرید روزمره را به فروشگاه‌های محلی پیوند می‌دهد و برای مشارکت اجتماعی مسیر شفاف‌تری فراهم می‌کند. با هر خرید، هم نیازهای خانواده تأمین می‌شود و هم کسب‌وکارهای محله فرصت رشد پیدا می‌کنند.</p><div className={styles.stats}><div><strong>خرید محلی</strong><span>پیوند با فروشگاه‌های نزدیک</span></div><div><strong>اثر اجتماعی</strong><span>مشارکت در توسعه محله</span></div></div></div></div></section>

      <section className={styles.benefits} id="benefits"><div className={styles.container}><div className={styles.centerHeading}><h2>یک حساب، چند امکان</h2><p>خرید روزانه و مشارکت اجتماعی را در حنا دنبال کنید.</p></div><div className={styles.benefitGrid}>{benefits.map(([title, body, number]) => <article className={styles.benefitCard} key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

      <section className={styles.finalCta}><div className={styles.ctaOverlay}><h2>حنا؛ بازارگاه گرم و عادلانهٔ محلهٔ شما</h2><p>خرید روزانه را با فروشگاه‌های محلی تجربه کنید.</p><div><Link href="/products" className={styles.primaryButton}>رفتن به کاتالوگ</Link><Link href="/seller/register" className={styles.ctaSecondary}>ثبت‌نام فروشگاه‌ها</Link></div></div></section>

      <footer className={styles.footer} id="footer"><div className={`${styles.container} ${styles.footerGrid}`}><div className={styles.footerBrand}><Image src="/hana-logo.png" alt="حنا" width={220} height={72} /><p>حنا بازارگاهی برای خرید هوشمندانه، حمایت اجتماعی و رونق فروشگاه‌های محلی است.</p></div><div><h3>طرح‌های حنا</h3><Link href="/products">تخفیف‌های روزانه</Link><Link href="/products">کالابرگ الکترونیک</Link><Link href="/products">طرح‌های ویژه</Link></div><div><h3>همکاری با ما</h3><Link href="/seller/register">ثبت‌نام فروشگاه</Link><a href="#impact">درباره حنا</a><Link href="/auth">پشتیبانی و ورود</Link></div><div><h3>دسترسی سریع</h3><Link href="/products">خرید کالا</Link><Link href="/auth">ورود یا ثبت‌نام</Link><a href="#how-it-works">راهنمای حنا</a></div></div><div className={`${styles.container} ${styles.footerBottom}`}><span>© حنا، بازارگاه خرید روزانه و حمایت اجتماعی</span><div><a href="#footer" aria-label="اینستاگرام حنا">◎</a><a href="#footer" aria-label="شبکه اجتماعی حنا">𝕏</a><a href="#footer" aria-label="شبکه اجتماعی حنا">in</a></div></div></footer>
    </main>
  );
}
