"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./henna-homepage.module.css";

const slides = [
  {
    src: "/landing/hero.webp",
    alt: "سفره‌ای از نان و خوراکی‌های محلی",
    title: "سبد خود را با محصولات تازه و محلی کامل کنید",
    description: "حنا پس از تکمیل سبد، هوشمندترین و به‌صرفه‌ترین فروشگاه‌های اطراف را در لحظه برایتان مقایسه می‌کند.",
  },
  {
    src: "/landing/impact.webp",
    alt: "فروشنده‌ای در فروشگاه محلی",
    title: "با خرید روزانه، فروشگاه‌های محله را همراهی کنید",
    description: "کالاهای موردنیاز را از فروشگاه‌های نزدیک انتخاب کنید.",
  },
  {
    src: "/landing/category-produce.webp",
    alt: "محصولات تازه و محلی",
    title: "محصولات تازه را برای خانه انتخاب کنید",
    description: "دسته‌بندی‌ها و پیشنهادهای روزانهٔ حنا را ببینید.",
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
    <div className={styles.heroVisual} aria-roledescription="اسلایدر" aria-label="پیشنهادهای حنا">
      <Image src={slide.src} alt={slide.alt} fill priority sizes="(max-width: 640px) 100vw, 50vw" />
      <div className={styles.carouselControls}>
        <button type="button" onClick={() => move(-1)} aria-label="اسلاید قبلی">‹</button>
        <button type="button" onClick={() => move(1)} aria-label="اسلاید بعدی">›</button>
      </div>
      <div className={styles.carouselDots} role="group" aria-label="انتخاب اسلاید">
        {slides.map((item, index) => <button key={item.src} type="button" aria-label={`رفتن به اسلاید ${index + 1}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} />)}
      </div>
      <div className={styles.heroCaption} aria-live="polite"><strong>{slide.title}</strong><span>{slide.description}</span></div>
    </div>
  );
}
