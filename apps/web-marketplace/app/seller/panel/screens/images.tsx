"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  isSupportedPreviewImage,
  visiblePreviewPictures,
  type ImageFilter,
  type ImageSort,
  type PreviewPicture,
} from "../../../../lib/seller-image-library-preview";
import styles from "./images.module.css";

const samples: PreviewPicture[] = [
  { id: "bread", name: "نان بربری سنتی", src: "/seller-panel/screens/products/imgImg.png", used: true, local: false },
  { id: "oil", name: "روغن آفتابگردان", src: "/seller-panel/screens/products/imgImg1.png", used: true, local: false },
  { id: "pattern1", name: "تصویر بسته‌بندی شماره ۱", src: "/seller-panel/screens/images/imgThumbnailArea.png", used: false, local: false },
  { id: "pattern2", name: "تصویر بسته‌بندی شماره ۲", src: "/seller-panel/screens/images/imgThumbnailArea1.png", used: false, local: false },
  { id: "pattern3", name: "تصویر بسته‌بندی شماره ۳", src: "/seller-panel/screens/images/imgThumbnailArea2.png", used: false, local: false },
  { id: "pattern4", name: "تصویر بسته‌بندی شماره ۴", src: "/seller-panel/screens/images/imgThumbnailArea3.png", used: false, local: false },
];

const filters: { key: ImageFilter; label: string }[] = [
  { key: "all", label: "همه تصاویر" },
  { key: "used", label: "در حال استفاده" },
  { key: "unused", label: "بدون اتصال" },
  { key: "local", label: "افزوده‌شده در این صفحه" },
];

function readableSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 2 }) + " مگابایت";
}

export function DesignScreen() {
  const [pictures, setPictures] = useState<PreviewPicture[]>(samples);
  const [filter, setFilter] = useState<ImageFilter>("all");
  const [sort, setSort] = useState<ImageSort>("recent");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const nextLocalId = useRef(0);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => { created.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const selected = pictures.find((image) => image.id === selectedId) ?? null;
  const visible = visiblePreviewPictures(pictures, filter, query, sort);
  const totalUsed = pictures.filter((image) => image.used).length;
  const localCount = pictures.filter((image) => image.local).length;

  function addFiles(files: File[]) {
    let rejected = 0;
    const added: PreviewPicture[] = [];
    for (const item of files) {
      if (!isSupportedPreviewImage(item)) { rejected++; continue; }
      const url = URL.createObjectURL(item);
      urls.current.add(url);
      nextLocalId.current += 1;
      added.push({
        id: "local-" + nextLocalId.current,
        name: item.name,
        src: url,
        used: false,
        local: true,
        mimeType: item.type,
        sizeBytes: item.size,
      });
    }
    if (added.length) {
      setPictures((current) => [...added, ...current]);
      setSelectedId(added[0].id);
      setFilter("all");
      setQuery("");
      setConfirmRemove(false);
    }
    if (added.length && rejected) {
      setNotice("تعداد " + added.length.toLocaleString("fa-IR") +
        " تصویر فقط برای پیش‌نمایش اضافه شد. تعداد " +
        rejected.toLocaleString("fa-IR") + " فایل نامعتبر پذیرفته نشد.");
    } else if (added.length) {
      setNotice("تصویر به پیش‌نمایش همین صفحه اضافه شد. هنوز در سرور ذخیره نشده و به هیچ کالایی متصل نیست.");
    } else if (files.length) {
      setNotice("فایل پذیرفته نشد. فقط JPG، PNG یا WebP با حجم بیش از صفر و حداکثر ۱۰ مگابایت مجاز است.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeLocalPicture() {
    if (!selected || !selected.local || selected.used) return;
    urls.current.delete(selected.src);
    URL.revokeObjectURL(selected.src);
    setPictures((current) => current.filter((image) => image.id !== selected.id));
    setSelectedId(null);
    setConfirmRemove(false);
    setNotice("فایل از همین پیش‌نمایش حذف شد؛ هیچ داده‌ای در سرور تغییر نکرد.");
  }

  function showPicture(image: PreviewPicture) {
    setSelectedId(image.id);
    setConfirmRemove(false);
  }

  return (
    <div className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>مدیریت رسانه‌های فروشگاه</p>
          <h1>کتابخانه تصاویر</h1>
          <p className={styles.subtitle}>تصاویر را پیدا کنید، بررسی کنید و برای مرحله بعد آماده نگه دارید.</p>
        </div>
        <button className={styles.primary} type="button" onClick={() => input.current?.click()}>
          <span aria-hidden="true">＋</span> افزودن تصویر
        </button>
      </header>

      <div className={styles.previewBanner} role="note">
        <strong>حالت پیش‌نمایش طراحی</strong>
        <span>این تصاویر نمونه‌اند. فایل‌هایی که اضافه می‌کنید فقط تا خروج از صفحه قابل مشاهده‌اند؛ بارگذاری روی سرور، تخصیص به کالا و ویرایش برش هنوز متصل نیست.</span>
      </div>

      <section className={styles.steps} aria-labelledby="guide-title">
        <div className={styles.stepHeading}>
          <h2 id="guide-title">از کجا شروع کنم؟</h2>
          <p>برای کار با تصویر، این سه مرحله را دنبال کنید.</p>
        </div>
        <ol className={styles.stepList}>
          <li><b>۱</b><div><strong>افزودن تصویر</strong><p>فایل JPG، PNG یا WebP را انتخاب کنید یا به بخش بارگذاری بکشید.</p></div></li>
          <li><b>۲</b><div><strong>دیدن و بررسی</strong><p>روی کارت تصویر بزنید؛ اندازه، وضعیت و پیش‌نمایش آن را ببینید.</p></div></li>
          <li><b>۳</b><div><strong>استفاده در کالا</strong><p>انتخاب تصویر برای کالای واقعی هنوز نیازمند اتصال مدیریت رسانه است.</p></div></li>
        </ol>
      </section>

      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp"
        multiple className={styles.fileInput} aria-label="انتخاب فایل‌های تصویر"
        onChange={onFileChange} />
      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button type="button" aria-label="بستن پیام" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className={styles.summary} aria-label="خلاصه کتابخانه">
        <div><span>کل تصاویر نمایشی</span><strong>{pictures.length.toLocaleString("fa-IR")}</strong></div>
        <div><span>متصل به کالای نمونه</span><strong>{totalUsed.toLocaleString("fa-IR")}</strong></div>
        <div><span>بدون اتصال</span><strong>{(pictures.length - totalUsed).toLocaleString("fa-IR")}</strong></div>
        <div><span>افزوده‌شده در این صفحه</span><strong>{localCount.toLocaleString("fa-IR")}</strong></div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.collection} aria-labelledby="collection-title">
          <div className={styles.sectionHead}>
            <div><h2 id="collection-title">تصاویر کتابخانه</h2><p>روی هر تصویر بزنید تا اطلاعات و اقدام‌های مجاز آن نمایش داده شود.</p></div>
            <span className={styles.resultCount}>{visible.length.toLocaleString("fa-IR")} نتیجه</span>
          </div>

          <div className={styles.controls}>
            <label className={styles.searchLabel}>
              <span>جست‌وجو در نام تصویر</span>
              <input type="search" placeholder="نام فایل یا کالا…" value={query}
                onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className={styles.sortLabel}>
              <span>مرتب‌سازی</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as ImageSort)}>
                <option value="recent">ترتیب افزودن</option>
                <option value="name">نام تصویر</option>
              </select>
            </label>
          </div>

          <div className={styles.filters} role="group" aria-label="فیلتر تصاویر">
            {filters.map(({ key, label }) => {
              const count = key === "all" ? pictures.length :
                key === "used" ? totalUsed :
                key === "unused" ? pictures.length - totalUsed : localCount;
              return <button key={key} type="button" aria-pressed={filter === key}
                className={filter === key ? styles.activeFilter : ""}
                onClick={() => setFilter(key)}>
                {label}<span>{count.toLocaleString("fa-IR")}</span>
              </button>;
            })}
          </div>

          {visible.length > 0 ? (
            <div className={styles.grid}>
              {visible.map((image) => (
                <button key={image.id} type="button"
                  aria-pressed={selectedId === image.id}
                  aria-label={"بررسی تصویر " + image.name}
                  className={styles.imageCard}
                  onClick={() => showPicture(image)}>
                  <div className={styles.thumbnail}><img src={image.src} alt="" /></div>
                  <div className={styles.cardInfo}>
                    <strong title={image.name}>{image.name}</strong>
                    <span className={image.local ? styles.localTag : image.used ? styles.usedTag : styles.unusedTag}>
                      {image.local ? "افزوده‌شده در این صفحه" :
                        image.used ? "متصل به کالای نمونه" : "بدون اتصال"}
                    </span>
                    <span className={styles.openHint}>مشاهده جزئیات <span aria-hidden="true">←</span></span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>تصویری مطابق این جست‌وجو پیدا نشد</strong>
              <p>جست‌وجو یا فیلتر را پاک کنید تا تصاویر دوباره دیده شوند.</p>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>نمایش همه تصاویر</button>
            </div>
          )}
        </section>

        <aside className={styles.detail} aria-label="جزئیات تصویر انتخاب‌شده">
          {!selected ? (
            <div className={styles.noSelection}>
              <div className={styles.emptyPreview} aria-hidden="true">▧</div>
              <h2>یک تصویر انتخاب کنید</h2>
              <p>بعد از انتخاب هر کارت، پیش‌نمایش و وضعیت آن اینجا نمایش داده می‌شود.</p>
              <button type="button" onClick={() => input.current?.click()}>یا تصویر جدیدی اضافه کنید</button>
            </div>
          ) : (
            <>
              <div className={styles.detailHeading}>
                <h2>جزئیات تصویر</h2>
                <button type="button" aria-label="بستن جزئیات تصویر"
                  onClick={() => { setSelectedId(null); setConfirmRemove(false); }}>×</button>
              </div>
              <div className={styles.largePreview}><img src={selected.src} alt={selected.name} /></div>
              <h3 className={styles.selectedTitle}>{selected.name}</h3>
              <dl className={styles.metadata}>
                <div><dt>منبع</dt><dd>{selected.local ? "فایل محلی همین نشست" : "تصویر نمونه طراحی"}</dd></div>
                <div><dt>وضعیت</dt><dd>{selected.used ? "متصل به کالای نمایشی" : "بدون اتصال"}</dd></div>
                {selected.sizeBytes !== undefined && <div><dt>حجم فایل</dt><dd>{readableSize(selected.sizeBytes)}</dd></div>}
                {selected.mimeType && <div><dt>نوع فایل</dt><dd dir="ltr">{selected.mimeType}</dd></div>}
              </dl>
              <div className={styles.detailHelp}>
                <strong>برای استفاده در کالا چه کنم؟</strong>
                <p>در فرم ثبت کالا، بخش تصاویر کالا قرار دارد؛ اما اتصال خودکار به این کتابخانه در پیش‌نمایش فعلی فعال نیست.</p>
                <Link href="/seller/panel/listing">مشاهده فرم نمونه ثبت کالا</Link>
              </div>
              {selected.local && !selected.used ? (
                confirmRemove ? (
                  <div className={styles.confirm} role="group" aria-label="تأیید حذف تصویر محلی">
                    <p>این فایل فقط از پیش‌نمایش همین صفحه حذف شود؟</p>
                    <div className={styles.actionRow}>
                      <button className={styles.danger} type="button" onClick={removeLocalPicture}>بله، حذف از این صفحه</button>
                      <button type="button" onClick={() => setConfirmRemove(false)}>انصراف</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={styles.secondaryDanger}
                    onClick={() => setConfirmRemove(true)}>حذف فایل محلی از این صفحه</button>
                )
              ) : (
                <p className={styles.restricted}>حذف این تصویر نمونه فعال نیست؛ هیچ تصویر یا اتصالی روی سرور تغییر نمی‌کند.</p>
              )}
            </>
          )}
        </aside>
      </div>

      <section className={styles.uploadZone} aria-label="افزودن فایل تصویر"
        onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <div className={styles.uploadIcon} aria-hidden="true">↥</div>
        <div><h2>تصویر جدید دارید؟</h2><p>فایل را اینجا بکشید یا از دستگاه انتخاب کنید. فرمت JPG، PNG یا WebP؛ حداکثر ۱۰ مگابایت برای هر فایل.</p></div>
        <button type="button" onClick={() => input.current?.click()}>انتخاب فایل تصویر</button>
      </section>
    </div>
  );
}
