import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  noStore,
  sessionCookieName,
} from "./server-auth";
import { parseAllocationModelComparisonSources } from "./allocation-model-comparison";

export async function forwardAllocationModelComparison(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });

  if (request.method !== "GET")
    return fail("درخواست معتبر نیست.", 405);

  const fingerprint =
    request.nextUrl.searchParams.get("evaluationFingerprint")?.trim().toLowerCase();
  if (!fingerprint || !/^[0-9a-f]{64}$/.test(fingerprint))
    return fail("Evaluation fingerprint معتبر لازم است.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.", 401);

  const paths = [
    "/api/v1/admin/allocation-proposals/research/benchmarks",
    "/api/v1/admin/allocation-proposals/research/shadow-benchmarks",
    "/api/v1/admin/allocation-proposals/research/ebm-benchmarks",
  ] as const;
  const targets = paths.map(path => hanaAuthApiUrl(
    `${path}?page=1&evaluationFingerprint=${encodeURIComponent(fingerprint)}`,
  ));
  if (targets.some(target => target === null))
    return fail("سرویس در دسترس نیست.", 503);

  try {
    const responses = await Promise.all(targets.map(target => fetch(target!, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    })));

    const failed = responses.find(response => !response.ok);
    if (failed) {
      const messages: Record<number, string> = {
        400: "Evaluation fingerprint معتبر نیست.",
        401: "دوباره وارد شوید.",
        403: "دسترسی مدیر لازم است.",
      };
      return fail(
        messages[failed.status] ?? "دریافت evidence مقایسه ممکن نشد.",
        messages[failed.status] ? failed.status : 503,
      );
    }

    const [profile, xgboost, ebm] = await Promise.all(
      responses.map(response => response.json() as Promise<unknown>),
    );
    const payload = { profile, xgboost, ebm };
    if (!parseAllocationModelComparisonSources(payload, fingerprint))
      return fail("Evidence مقایسه قابل تأیید نیست.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return fail("دریافت evidence مقایسه ممکن نشد.", 503);
  }
}
