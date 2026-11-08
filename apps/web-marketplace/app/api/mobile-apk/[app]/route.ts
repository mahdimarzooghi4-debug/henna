import { approvedAndroidReleaseUrl } from "../../../../lib/mobile-release-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
};

const response = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(
  _request: Request,
  context: { params: Promise<{ app: string }> },
) {
  const { app } = await context.params;
  // Seller downloads must use the session-authenticated and activation-checked BFF.
  // This public route must never proxy a seller APK, regardless of configured URL.
  if (app !== "buyer") return response("اپلیکیشن پیدا نشد.", 404);

  const url = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_APPROVED_URL,
  ) ?? approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_PREVIEW_URL,
  );
  if (!url)
    return response("نسخه تأییدشده یا آزمایشی خریدار در دسترس نیست.", 503);

  // No embedded release asset IDs or fallback to unapproved CI artifacts.
  return new Response(null, {
    status: 302,
    headers: { ...noStore, Location: url },
  });
}
