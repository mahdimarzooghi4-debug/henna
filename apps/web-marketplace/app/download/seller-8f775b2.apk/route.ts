export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apkUrl =
  "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-2031-1/hana-seller-preview.apk";
const sha256 =
  "7a5c238b996b13c25c0acfed74c73a20c6eaaae177d369b34d52bb2d1dc624e2";
const byteLength = 76679690;

export async function GET(request: Request) {
  try {
    const requestHeaders = new Headers();
    const range = request.headers.get("range");
    if (range) requestHeaders.set("range", range);

    const upstream = await fetch(apkUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: requestHeaders,
    });

    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
      await upstream.body?.cancel().catch(() => undefined);
      return new Response("فایل نصب فروشنده فعلاً در دسترس نیست.", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const headers = new Headers({
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="hana-seller-preview.apk"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ETag: '"sha256-' + sha256 + '"',
    });

    for (const name of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!range && !headers.has("Content-Length")) {
      headers.set("Content-Length", String(byteLength));
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response("فایل نصب فروشنده فعلاً در دسترس نیست.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
