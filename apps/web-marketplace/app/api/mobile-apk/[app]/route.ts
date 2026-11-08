export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assets: Record<string, { assetId: string; fileName: string }> = {
  buyer: { assetId: "723510552", fileName: "hana-buyer-preview.apk" },
  seller: { assetId: "723510548", fileName: "hana-seller-preview.apk" },
};
const releaseAssetsHost = "release-assets.githubusercontent.com";
const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

type CachedLink = { url: string; expiresAt: number };
const cachedLinks: Partial<Record<string, CachedLink>> = {};

const response = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
  });

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { ...noStore, Location: url },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ app: string }> },
) {
  const { app } = await context.params;
  const asset = assets[app];
  if (!asset) return response("اپلیکیشن پیدا نشد.", 404);

  const cached = cachedLinks[app];
  if (cached && cached.expiresAt > Date.now())
    return redirect(cached.url);

  const apiUrl = `https://api.github.com/repos/mahdimarzooghi4-debug/henna/releases/assets/${asset.assetId}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const upstream = await fetch(apiUrl, {
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/octet-stream",
          "User-Agent": "Henna-Mobile-Preview/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      const location = upstream.headers.get("location");
      if (upstream.status === 302 && location) {
        const target = new URL(location);
        if (target.protocol !== "https:" || target.hostname !== releaseAssetsHost ||
            !target.pathname.startsWith("/github-production-release-asset/"))
          return response("نشانی فایل اپ معتبر نیست.", 502);
        cachedLinks[app] = { url: target.href, expiresAt: Date.now() + 15 * 60_000 };
        return redirect(target.href);
      }
      if (upstream.status < 500 || attempt === 2)
        return response("دریافت نشانی فایل ممکن نشد؛ کمی بعد دوباره تلاش کنید.", 503);
    } catch (error) {
      if (attempt === 2) {
        console.warn("Mobile preview link lookup failed", {
          app,
          name: error instanceof Error ? error.name : "unknown",
        });
        return response("ارتباط با مخزن اپ برقرار نشد؛ کمی بعد دوباره تلاش کنید.", 503);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return response("فایل اپ موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.", 503);
}
