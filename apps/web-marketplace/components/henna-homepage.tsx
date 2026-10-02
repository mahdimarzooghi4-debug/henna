import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import HeroCarousel from "./hero-carousel";
import { LandingFooter, LandingHeader } from "./landing-chrome";
import { LandingAddButton } from "./landing-add-button";
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

function categoryHref(label: string) {
  return `/products?categoryName=${encodeURIComponent(label)}#buyer-categories-title`;
}

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
      <LandingHeader />

      <div className={styles.shoppingArea}>
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="home-title">
          <HeroCarousel />
        </section>

        <div className={`${styles.container} ${styles.promoGrid}`}>
          <Link href="/discounts" className={`${styles.promoCard} ${styles.promoTerracotta}`}><span className={styles.promoTitle}><strong>تخفیف‌دارهای روزانه</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/percent.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>محبوب‌ترین کالاهای سبد خرید روزانه شما با قیمت‌های استثنایی و فرصت‌های خرید تکرارنشدنی</span><span className={styles.promoMore}>لیست تخفیف‌ها ←</span></Link>
          <Link href="/benefits#food-credit" className={`${styles.promoCard} ${styles.promoBeige}`}><span className={styles.promoTitle}><strong>کالابرگ الکترونیک</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/credit-card.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>امکان پرداخت سهم یارانه‌ای با استفاده از کارت‌های معتبر حمایتی برای اقلام اساسی مصوب</span><span className={styles.promoMore}>استفاده از کالابرگ ←</span></Link>
          <Link href="/benefits#special-plans" className={`${styles.promoCard} ${styles.promoGreen}`}><span className={styles.promoTitle}><strong>طرح‌های ویژه حنا</strong><span className={styles.promoIcon} aria-hidden="true"><Image src="/landing/icons/gift.svg" alt="" width={24} height={24} /></span></span><span className={styles.promoCopy}>بسته‌ها و فرصت‌های خرید اشتراکی خانواده و محله با مشارکت مستقیم فروشگاه‌های منتخب</span><span className={styles.promoMore}>مشاهده طرح‌ها ←</span></Link>
        </div>

        <section className={`${styles.container} ${styles.categories}`} id="categories">
          <div className={styles.sectionHeading}><h2>دسته‌بندی‌های محبوب</h2><Link href="/products#buyer-categories-title">مشاهده همه دسته‌ها</Link></div>
          <div className={styles.categoryGrid}>{categories.map(([label, image]) => <Link className={styles.category} href={categoryHref(label)} key={label}><span><Image src={`/landing/${image}`} alt="" width={100} height={100} /></span><strong>{label}</strong></Link>)}</div>
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
                  <LandingAddButton productName={product.title} className={styles.addButton} messageClassName={styles.addMessage} />
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

      <LandingFooter />
    </main>
  );
}
