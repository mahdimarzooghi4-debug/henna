"use client";

import { useEffect, useState } from "react";
import styles from "./henna-homepage.module.css";

const heroSlides = [
  {
    announcement: "🎉 طرح جدید کالابرگ حنا فعال شد؛ خریدی هوشمندانه با بیشترین حمایت اجتماعی",
    eyebrow: "همراه با ارزش‌آفرینی محلی و اجتماعی",
    title: <>خرید روزمره،<br />با اثری فراتر از خرید</>,
    description: "در حنا ابتدا با خیال آسوده کالاها، تخفیف‌ها و اقلام کالابرگ خود را انتخاب و سبد خریدتان را کامل کنید. پس از آماده شدن سبد، حنا به طور خودکار فروشگاه‌های تا شعاع ۵ کیلومتری شما را از نظر قیمت، موجودی کامل کالاها و سرعت ارسال مقایسه کرده و بهترین پیشنهاد خرید را ارائه می‌دهد.",
    image: "/landing/figma/hero-slide-1.png",
    imageAlt: "محصولات تازه و محلی برای سبد خرید روزانه",
    caption: "سبد خود را با محصولات تازه و محلی کامل کنید",
    captionDetail: "حنا پس از تکمیل سبد، هوشمندترین و به‌صرفه‌ترین فروشگاه‌های اطراف را در لحظه برایتان مقایسه می‌کند.",
    secondary: "مشاهده پیشنهادها",
    primary: "شروع خرید روزانه",
    secondaryHref: "#offers",
    primaryHref: "#offers",
  },
  {
    announcement: "🌱 با خرید از حنا، اقتصاد کسب‌وکارهای کوچک و سنتی محله خود را تقویت کنید",
    eyebrow: "عدالت اجتماعی و توسعه پایدار شهری",
    title: <>کسب‌وکارهای محلی،<br />رگ‌های حیاتی محله ما</>,
    description: "حنا با فراهم کردن بستری عادلانه برای رقابت، به سوپرمارکت‌های محلی اجازه می‌دهد بدون نیاز به پورسانت‌های سنگین، خدمات آنلاین ارائه دهند. با هر خرید، سهمی از درآمد به‌صورت کاملاً شفاف به پروژه‌های عمرانی یا تحصیلی در همان محله تخصیص می‌یابد.",
    image: "/landing/figma/hero-slide-2.png",
    imageAlt: "فروشگاه و کسب‌وکار محلی در محله",
    caption: "حمایت عادلانه از کاسبان سنتی محله",
    captionDetail: "حنا سفارش شما را مستقیماً به خواربارفروشی‌های کوچک متصل کرده و از حذف کاسبان محلی جلوگیری می‌کند.",
    secondary: "طرح‌های مسئولیت اجتماعی",
    primary: "خرید از کسب‌وکارهای محلی",
    secondaryHref: "#impact",
    primaryHref: "#offers",
  },
  {
    announcement: "💳 سهم یارانه خود را در لحظه محاسبه کنید؛ خریدی بی‌دغدغه با پشتیبانی از کالابرگ الکترونیکی",
    eyebrow: "پشتیبانی از ۱۱ قلم کالای اساسی مصوب",
    title: <>مدیریت هوشمند اعتبار<br />کالابرگ الکترونیکی حنا</>,
    description: "بدون نیاز به مراجعه حضوری به چندین فروشگاه یا داشتن محاسبات پیچیده، حنا سهم یارانه‌ای لبنیات، برنج، روغن و قند شما را کسر می‌کند. بهترین فروشگاه‌های همکار که بیشترین تطابق با سبد کالابرگ شما را دارند، انتخاب خواهند شد.",
    image: "/landing/figma/hero-slide-3.png",
    imageAlt: "کیسه برنج از اقلام اساسی کالابرگ",
    caption: "محاسبه خودکار و آنی سهم کالابرگ",
    captionDetail: "سیستم هوشمند حنا اقلام اساسی سبدتان را تفکیک کرده و مبلغ پرداختی با کارت حمایتی را مشخص می‌کند.",
    secondary: "استعلام اعتبار یارانه",
    primary: "خرید با کالابرگ",
    secondaryHref: "#offers",
    primaryHref: "#offers",
  },
];

const categories = [
  ["نان و شیرینی", "figma/category-bread.png"],
  ["کنسرو و آماده", "figma/category-canned.png"],
  ["بهداشتی و سلامت", "figma/category-health.png"],
  ["میوه و صیفی", "figma/category-produce.png"],
  ["روغن و خواربار", "figma/category-grocery.png"],
  ["نوشیدنی‌ها", "figma/category-drinks.png"],
  ["لبنیات محلی", "figma/category-dairy.png"],
];

const products = [
  { title: "پنیر سفید ایرانی ممتاز", subtitle: "۴۰۰ گرم - لبنیات هراز", image: "figma/product-cheese.png", price: "۵۴,۰۰۰", old: "۶۵,۰۰۰", tag: "ویژه کالابرگ" },
  { title: "ماست سون همزده پرچرب", subtitle: "۹۰۰ گرم - کاله", image: "figma/product-yogurt.png", price: "۴۸,۵۰۰", old: "", tag: "تخفیف ویژه" },
  { title: "برنج هاشمی درجه یک", subtitle: "۵ کیلوگرم - کشتزار شمال", image: "figma/product-rice.png", price: "۶۴۰,۰۰۰", old: "۷۲۰,۰۰۰", tag: "طرح حمایتی" },
  { title: "روغن آفتابگردان خالص", subtitle: "۱.۵ لیتر - لادن", image: "figma/product-oil.png", price: "۸۹,۰۰۰", old: "", tag: "" },
  { title: "چای سیاه ارگانیک لاهیجان", subtitle: "۴۵۰ گرم - ممتاز باروتی", image: "figma/product-tea.png", price: "۱۲۸,۰۰۰", old: "۱۴۵,۰۰۰", tag: "تخفیف ویژه" },
];

const benefits = [
  ["خرید شخصی و روزانه", "به عنوان یک کاربر حقیقی به تمام اقلام سوپرمارکتی دسترسی دارید؛ با بهترین قیمت سبد خرید روزمره‌تان را تامین و تحویل فوری بگیرید.", "/landing/figma/icon-shopping-bag.png"],
  ["مشارکت اجتماعی فعال", "سفارش‌های حقوقی سازمان‌ها یا مسئولیت‌های اجتماعی شخصی خود را با تضمین قیمت کف و تخصیص مستقیم سهم توسعه محلی ثبت کنید.", "/landing/figma/icon-heart.png"],
  ["دریافت اعتبار حمایتی", "اگر واجد شرایط طرح‌های حمایتی دولتی یا سازمانی هستید، می‌توانید اعتبار دریافتی خود را بلافاصله در همان حساب فعال و خرج اقلام سبد کنید.", "/landing/figma/icon-award.png"],
];

export default function HennaHomepage() {
  const [activeHero, setActiveHero] = useState(0);
  const hero = heroSlides[activeHero];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHero((current) => (current + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const moveHero = (step: number) => {
    setActiveHero((current) => (current + step + heroSlides.length) % heroSlides.length);
  };

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.announcement} aria-live="polite">{hero.announcement}</div>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.actions}>
            <a className={styles.cart} href="/products"><img src="/landing/shopping-cart.svg" alt="" /> سبد خرید <span className={styles.cartCount}>۰</span></a>
            <a className={styles.login} href="/auth">ورود یا ثبت‌نام <img src="/landing/user.svg" alt="" /></a>
            <span className={styles.divider} />
            <a className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</a>
          </div>
          <a href="/" className={styles.brand} aria-label="حنا، صفحه اصلی"><img className={styles.logoImage} src="/hana-logo.png" alt="حنا" /></a>
          <form className={styles.search} action="/products">
            <input name="q" placeholder="جست‌وجوی نان، لبنیات، برنج و اقلام روزانه..." aria-label="جستجو" />
            <button aria-label="جستجو"><img src="/landing/search.svg" alt="" /></button>
          </form>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          <a href="#categories" aria-current="page">همه‌ دسته‌ها</a><a href="#categories">میوه و سبزیجات</a><a href="#categories">نوشیدنی‌ها</a><a href="#categories">خواربار و نان</a><a href="#categories">لبنیات و تخم مرغ</a><a href="#offers">طرح‌های ویژه حنا</a><a href="#offers">کالابرگ الکترونیکی</a><a href="#offers">تخفیف‌های طلایی</a>
        </nav>
      </header>

      <section className={styles.shoppingArea}>
        <div className={`${styles.container} ${styles.hero}`} aria-label="اسلایدهای معرفی حنا" aria-roledescription="carousel">
          <div className={styles.heroCopy} key={`copy-${activeHero}`} aria-live="polite">
            <span className={styles.eyebrow}>{activeHero === 0 && <img src="/landing/figma/icon-users.png" alt="" />}<span>{hero.eyebrow}</span></span>
            <h1>{hero.title}</h1>
            <p>{hero.description}</p>
            <div className={styles.heroButtons}>
              <a className={styles.secondaryButton} href={hero.secondaryHref}>{hero.secondary}</a>
              <a className={styles.primaryButton} href={hero.primaryHref}>{hero.primary}</a>
            </div>
          </div>
          <div className={styles.heroVisual} key={`visual-${activeHero}`}>
            <img src={hero.image} alt={`${hero.imageAlt}؛ ${hero.caption}؛ ${hero.captionDetail}`} />
            <div className={styles.heroControls} aria-label="کنترل اسلایدها">
              <button type="button" onClick={() => moveHero(1)} aria-label="اسلاید بعدی">‹</button>
              <div className={styles.heroDots}>
                {heroSlides.map((slide, index) => <button type="button" key={slide.eyebrow} className={index === activeHero ? styles.heroDotActive : styles.heroDot} aria-label={`رفتن به اسلاید ${index + 1}`} aria-current={index === activeHero ? "true" : undefined} onClick={() => setActiveHero(index)} />)}
              </div>
              <button type="button" onClick={() => moveHero(-1)} aria-label="اسلاید قبلی">›</button>
            </div>
          </div>
        </div>

        <div className={`${styles.container} ${styles.promoGrid}`}>
          <a href="#offers" className={`${styles.promoCard} ${styles.promoTerracotta}`}><span className={styles.promoTitle}><img src="/landing/figma/icon-percent.png" alt="" /><strong>تخفیف‌دارهای روزانه</strong></span><p>محبوب‌ترین کالاهای سبد خرید روزانه شما با قیمت‌های استثنایی و فرصت‌های خرید تکرارنشدنی</p><span className={styles.promoMore}>لیست تخفیف‌ها ←</span></a>
          <a href="#offers" className={`${styles.promoCard} ${styles.promoBeige}`}><span className={styles.promoTitle}><img src="/landing/figma/icon-credit-card.png" alt="" /><strong>کالابرگ الکترونیک</strong></span><p>امکان پرداخت سهم یارانه‌ای با استفاده از کارت‌های معتبر حمایتی برای اقلام اساسی مصوب</p><span className={styles.promoMore}>استفاده از کالابرگ ←</span></a>
          <a href="#benefits" className={`${styles.promoCard} ${styles.promoGreen}`}><span className={styles.promoTitle}><img src="/landing/figma/icon-gift.png" alt="" /><strong>طرح‌های ویژه حنا</strong></span><p>بسته‌ها و فرصت‌های خرید اشتراکی خانواده و محله با مشارکت مستقیم فروشگاه‌های منتخب</p><span className={styles.promoMore}>مشاهده طرح‌ها ←</span></a>
        </div>

        <section className={`${styles.container} ${styles.categories}`} id="categories">
          <div className={styles.sectionHeading}><h2>دسته‌بندی‌های محبوب</h2><a href="/products">مشاهده همه دسته‌ها</a></div>
          <div className={styles.categoryGrid}>{categories.map(([label, image]) => <a className={styles.category} href="/products" key={label}><span><img src={`/landing/${image}`} alt="" /></span><strong>{label}</strong></a>)}</div>
        </section>

        <section className={`${styles.container} ${styles.offers}`} id="offers">
          <div className={styles.sectionHeading}><h2>پیشنهادهای امروز</h2><a href="/products">مشاهده همه محصولات</a></div>
          <div className={styles.productGrid}>{products.map((product) => <article className={styles.productCard} key={product.title}><div className={styles.productImage}><img src={`/landing/${product.image}`} alt={product.title} />{product.tag && <span>{product.tag}</span>}</div><div className={styles.productInfo}><h3>{product.title}</h3><p>{product.subtitle}</p></div><div className={styles.productAction}><a href="/products" className={styles.addButton}>افزودن +</a><div className={styles.productPrice}>{product.old && <del>{product.old}</del>}<strong>{product.price} <small>تومان</small></strong></div></div></article>)}</div>
        </section>
      </section>

      <section className={styles.steps} id="how-it-works">
        <div className={styles.container}><div className={styles.centerHeading}><h2>چرا خرید از حنا هوشمندانه‌تر است؟</h2><p>فرآیند خرید و مقایسه برای انتخاب بهترین فروشگاه</p></div>
          <div className={styles.stepsGrid}><div><span>۱</span><h3>انتخاب آزادانه کالاها</h3><p>کالاها، لبنیات، نان روزانه، تخفیف‌ها یا اقلام کالابرگی مورد نیاز خود را مستقیماً جست‌وجو کرده و بدون محدودیت به سبد خریدتان اضافه کنید.</p></div><b aria-hidden="true"><img src="/landing/figma/icon-arrow-left.png" alt="" /></b><div><span>۲</span><h3>مقایسه فروشگاه‌های نزدیک</h3><p>حنا فروشگاه‌های محله تا شعاع ۵ کیلومتری را بر اساس کمترین قیمت کل، درصد موجودی اقلام سبد و زمان تحویل با هم مقایسه و پیشنهاد می‌کند.</p></div><b aria-hidden="true"><img src="/landing/figma/icon-arrow-left.png" alt="" /></b><div><span>۳</span><h3>ثبت سفارش از بهترین گزینه</h3><p>سفارش شما در کمتر از ۳۰ دقیقه مستقیماً توسط پیک ارسال شده و سهم حمایت اجتماعی خریدتان در لحظه ثبت می‌شود.</p></div></div>
        </div>
      </section>

      <section className={styles.impact} id="impact"><div className={`${styles.container} ${styles.impactInner}`}><img src="/landing/figma/impact-photo.png" alt="فروشنده محلی در فروشگاه مواد غذایی" /><div><span className={styles.eyebrow}>ارزش اجتماعی و توسعه محلی</span><h2>خریدی که اثرش ادامه پیدا می‌کند</h2><p>ما در حنا معتقدیم خرید روزمره می‌تواند فراتر از تامین نیازهای مصرفی باشد. با اتصال مستقیم شما به سوپرمارکت‌ها و فروشگاه‌های محله خودتان، نه‌تنها اقتصاد کسب‌وکارهای کوچک محلی تقویت می‌شود، بلکه سهمی از درآمد هر خرید صرف صندوق حمایت ازمحرومان واجد شرایط یا توانمندسازی خانواده‌های محلی می‌شود. همه‌چیز شفاف، انسانی و بدون هزینه اضافی برای شماست.</p><div className={styles.stats}><div><strong>۳,۴۰۰+</strong><span>فروشگاه محلی فعال</span></div><div><strong>۱۲,۸۰۰+</strong><span>خانواده تحت پوشش حمایتی</span></div></div></div></div></section>

      <section className={styles.benefits} id="benefits"><div className={styles.container}><div className={styles.centerHeading}><h2>یک حساب، چند امکان</h2><p>تمام نیازهای خرید روزانه و حمایت‌های سازمانی یا حاکمیتی در یک درگاه امن</p></div><div className={styles.benefitGrid}>{benefits.map(([title, body, icon]) => <article className={styles.benefitCard} key={title}><span><img src={icon} alt="" /></span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

      <section className={styles.finalCta}><div className={styles.ctaOverlay}><h2>حنا؛ بازارگاه گرم و عادلانه محله شما</h2><p>همین حالا اولین سبد خرید خود را پر کنید و هوشمندترین مقایسه قیمت را در محله خود تجربه کنید. با هر خرید، لبخندی بر لبان فروشندگان کوچک محله بنشانید.</p><div><a href="/products" className={styles.primaryButton}>شروع پر کردن سبد خرید</a><a href="/seller/register" className={styles.ctaSecondary}>ثبت‌نام فروشگاه‌ها و تامین‌کنندگان</a></div></div></section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={`${styles.footerColumn} ${styles.footerSupport}`}>
            <h3>طرح‌های حمایتی</h3>
            <a href="#benefits">ثبت‌نام کالابرگ</a>
            <a href="#benefits">اعتبارات سازمانی</a>
            <a href="#benefits">کارت‌های معیشتی</a>
            <a href="#benefits">گزارش شفافیت مالی</a>
          </div>
          <div className={`${styles.footerColumn} ${styles.footerCooperation}`}>
            <h3>همکاری با حنا</h3>
            <a href="/seller/register">ثبت فروشگاه جدید</a>
            <a href="/seller">پنل فروشندگان</a>
            <a href="/seller/register">شرایط همکاری پیک‌ها</a>
            <a href="/careers">فرصت‌های شغلی</a>
          </div>
          <div className={`${styles.footerColumn} ${styles.footerQuickLinks}`}>
            <h3>دسترسی سریع</h3>
            <a href="/faq">سوالات متداول</a>
            <a href="/terms">قوانین و مقررات</a>
            <a href="#impact">درباره حنا</a>
            <a href="/support">تماس با پشتیبانی</a>
          </div>
          <div className={styles.footerBrand}>
            <img className={styles.logoImage} src="/hana-logo.png" alt="حنا" />
            <p>حنا اولین بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p>
          </div>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`}>
          <div className={styles.footerSocial}>
            <a href="#impact" aria-label="اینستاگرام حنا"><img src="/landing/instagram.svg" alt="" /></a>
            <a href="#impact" aria-label="توییتر حنا"><img src="/landing/twitter.svg" alt="" /></a>
            <a href="#impact" aria-label="لینکدین حنا"><img src="/landing/linkedin.svg" alt="" /></a>
          </div>
          <p className={styles.footerCopyright}>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است.<br />کلیه حقوق برای حنا محفوظ است.</p>
        </div>
      </footer>
    </main>
  );
}
