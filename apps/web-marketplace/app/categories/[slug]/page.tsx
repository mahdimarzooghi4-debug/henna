import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyerBrowse } from "../../../components/buyer-browse";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { LANDING_CATEGORIES, landingCategoryBySlug } from "../../../lib/landing-category-pages";
import styles from "./page.module.css";

export function generateStaticParams() {
  return LANDING_CATEGORIES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const category = landingCategoryBySlug((await params).slug);
  return {
    title: category ? category.label + " | دسته‌بندی‌های حنا" : "دسته‌بندی یافت نشد | حنا",
    description: category?.description,
  };
}

export default async function LandingCategoryPage({ params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = landingCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className={styles.page} dir="rtl">
      <LandingHeader />
      <div className={styles.intro} data-testid="landing-category-intro">
        <div className={styles.introText}>
          <nav aria-label="مسیر دسته‌بندی" className={styles.breadcrumb}>
            <Link href="/">خانه</Link><span aria-hidden="true">/</span>
            <Link href="/products">دسته‌بندی‌ها</Link><span aria-hidden="true">/</span>
            <span>{category.label}</span>
          </nav>
          <h1>{category.label}</h1>
          <p>{category.description}</p>
          <p className={styles.notice}>کارت‌های تصویری صفحه اصلی، دسته‌بندی‌های پیشنهادی طراحی‌اند. کالاها فقط پس از تطبیق با دسته‌های منتشرشده از کاتالوگ واقعی نمایش داده می‌شوند.</p>
          <Link className={styles.allProducts} href="/products">مشاهده همه کالاها و خدمات</Link>
        </div>
        <Image src={"/landing/" + category.image} alt="" width={168} height={168} className={styles.image} />
      </div>
      <BuyerBrowse initialCategoryName={category.label} />
      <LandingFooter />
    </div>
  );
}
