"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./henna-homepage.module.css";

const slides = [
  {
    src: "/landing/hero-slide-1.png",
    alt: "تصویر اسلاید اول هیرو از طرح فیگما",
    eyebrow: "همراه با ارزش‌آفرینی محلی و اجتماعی",
    title: <>خرید روزمره،<br />با اثری فراتر از خرید</>,
    description: "در حنا ابتدا با خیال آسوده کالاها، تخفیف‌ها و اقلام کالابرگ خود را انتخاب و سبد خریدتان را کامل کنید. پس از آماده شدن سبد، حنا به طور خودکار فروشگاه‌های تا شعاع ۵ کیلومتری شما را از نظر قیمت، موجودی کامل کالاها و سرعت ارسال مقایسه کرده و بهترین پیشنهاد خرید را ارائه می‌دهد.",
    secondary: "مشاهده پیشنهادها",
    primary: "شروع خرید روزانه",
  },
  {
    src: "/landing/hero-slide-2.png",
    alt: "تصویر اسلاید دوم هیرو از طرح فیگما",
    eyebrow: "عدالت اجتماعی و توسعه پایدار شهری",
    title: <>کسب‌وکارهای محلی،<br />رگ‌های حیاتی محله ما</>,
    description: "حنا با فراهم کردن بستری عادلانه برای رقابت، به سوپرمارکت‌های محلی اجازه می‌دهد بدون نیاز به پورسانت‌های سنگین، خدمات آنلاین ارائه دهند. با هر خرید، سهمی از درآمد به‌صورت کاملاً شفاف به پروژه‌های عمرانی یا تحصیلی در همان محله تخصیص می‌یابد.",
    secondary: "طرح‌های مسئولیت اجتماعی",
    primary: "خرید از کسب‌وکارهای محلی",
  },
  {
    src: "/landing/hero-slide-3.png",
    alt: "تصویر اسلاید سوم هیرو از طرح فیگما",
    eyebrow: "پشتیبانی از ۱۱ قلم کالای اساسی مصوب",
    title: <>مدیریت هوشمند اعتبار<br />کالابرگ الکترونیکی حنا</>,
    description: "بدون نیاز به مراجعه حضوری به چندین فروشگاه یا داشتن محاسبات پیچیده، حنا سهم یارانه‌ای لبنیات، برنج، روغن و قند شما را کسر می‌کند. بهترین فروشگاه‌های همکار که بیشترین تطابق با سبد کالابرگ شما را دارند، انتخاب خواهند شد.",
    secondary: "استعلام اعتبار یارانه",
    primary: "خرید با کالابرگ",
  },
] as const;

export default function HeroCarousel() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className={styles.heroCopy} aria-live="polite">
        <span className={styles.eyebrow}>{slide.eyebrow}</span>
        <h1 id="home-title">{slide.title}</h1>
        <p>{slide.description}</p>
        <div className={styles.heroButtons}>
          <a className={styles.secondaryButton} href={active === 1 ? "#impact" : active === 2 ? "/products" : "#offers"}>{slide.secondary}</a>
          <Link className={styles.primaryButton} href="/products">{slide.primary}</Link>
        </div>
      </div>
      <div className={styles.heroVisual} aria-roledescription="اسلایدر" aria-label="پیشنهادهای حنا">
        <Image src={slide.src} alt={slide.alt} fill priority sizes="(max-width: 640px) 100vw, 50vw" />
        <div className={styles.carouselControls}>
          <button type="button" onClick={() => move(-1)} aria-label="اسلاید قبلی">‹</button>
          <button type="button" onClick={() => move(1)} aria-label="اسلاید بعدی">›</button>
        </div>
        <div className={styles.carouselDots} role="group" aria-label="انتخاب اسلاید">
          {slides.map((item, index) => <button key={item.src} type="button" aria-label={`رفتن به اسلاید ${index + 1}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} />)}
        </div>
      </div>
    </>
  );
}
