import { approvedAndroidReleaseUrl } from "../../../../lib/mobile-release-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

const errorResponse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(
  _request: Request,
  context: { params: Promise<{ app: string }> },
) {
  const { app } = await context.params;
  const config = app === "buyer"
    ? { name: "hana-buyer-preview.apk", url: process.env.HANA_BUYER_ANDROID_PREVIEW_URL }
    : app === "seller"
      ? { name: "hana-seller-preview.apk", url: process.env.HANA_SELLER_ANDROID_PREVIEW_URL }
      : null;

  if (!config)
    return errorResponse("اپلیکیشن پیدا نشد.", 404);

  const url = approvedAndroidReleaseUrl(config.url);
  if (!url)
    return errorResponse("فایل آزمایشی این اپ هنوز تنظیم نشده است.", 404);

  let upstream: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      upstream = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: { Accept: "application/vnd.android.package-archive" },
      });
      if (upstream.ok) break;
      if (upstream.status < 500 || attempt === 1)
        return errorResponse("دریافت فایل اپ ممکن نشد؛ چند لحظه بعد دوباره تلاش کنید.", 502);
    } catch {
      if (attempt === 1)
        return errorResponse("ارتباط با مخزن اپ برقرار نشد؛ چند لحظه بعد دوباره تلاش کنید.", 502);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (!upstream?.ok || !upstream.body)
    return errorResponse("فایل اپ در دسترس نیست؛ چند لحظه بعد دوباره تلاش کنید.", 502);

  const headers = new Headers({
    ...noStore,
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${config.name}"`,
  });
  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length))
    headers.set("Content-Length", length);

  return new Response(upstream.body, { status: 200, headers });
}
