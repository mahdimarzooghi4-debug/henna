import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "./server-auth";
import {
  commerceId,
  parseStaffCommerce,
  staffMessages,
  type StaffScope,
} from "./staff-commerce";

async function boundedText(response: Request | Response, max: number) {
  if (!response.body) throw Error();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw Error();
      }
      out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function boundedBytes(response: Response, max: number) {
  if (!response.body) throw Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw Error();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function failure(status: number, code = "") {
  const message = staffMessages[code] ??
    (status === 401 ? "برای ادامه وارد شوید." :
      status === 403 ? "مجوز لازم برای این پنل فعال نیست." :
        status === 404 ? "رکورد موردنظر پیدا نشد یا قابل مشاهده نیست." :
          status === 400 ? "درخواست نامعتبر است." :
            "دریافت یا ثبت اطلاعات تأیید نشد.");
  return NextResponse.json({ code, message }, { status, headers: noStore });
}

function listPage(request: NextRequest): number | null {
  if (request.nextUrl.searchParams.size === 0) return 1;
  if (request.nextUrl.searchParams.size !== 1) return null;
  const value = request.nextUrl.searchParams.get("page");
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value) ||
      Number(value) > 10000) return null;
  return Number(value);
}

function routeFor(
  scope: StaffScope,
  segments: string[],
  method: "GET" | "POST",
): { upstream: string; parsePath: string; page: number } | null {
  const path = segments.join("/");
  if (method === "GET") {
    if (scope === "seller" && (path === "orders" || path === "returns"))
      return {
        upstream: path === "orders" ? "/seller/orders" : "/seller/incidents",
        parsePath: path,
        page: 1,
      };
    if (scope === "support" && path === "incidents")
      return { upstream: "/support/incidents", parsePath: path, page: 1 };
    if (scope === "support" && segments.length === 2 &&
        segments[0] === "evidence" && commerceId(segments[1]))
      return {
        upstream: "/evidence/" + segments[1],
        parsePath: path,
        page: 1,
      };
    return null;
  }

  if (scope === "seller" && segments.length === 3 &&
      segments[0] === "orders" && commerceId(segments[1]) &&
      segments[2] === "state")
    return {
      upstream: "/seller/orders/" + segments[1] + "/state",
      parsePath: path,
      page: 1,
    };
  if (scope === "seller" && segments.length === 3 &&
      segments[0] === "returns" && commerceId(segments[1]) &&
      ["contact", "visit"].includes(segments[2]))
    return {
      upstream: "/seller/item-returns/" + segments[1] + "/" + segments[2],
      parsePath: path,
      page: 1,
    };
  if (scope === "support" && segments.length === 3 &&
      segments[0] === "incidents" && commerceId(segments[1]) &&
      segments[2] === "decision")
    return {
      upstream: "/support/incidents/" + segments[1] + "/decision",
      parsePath: path,
      page: 1,
    };
  return null;
}

export async function forwardStaffCommerce(
  request: NextRequest,
  scope: StaffScope,
  segments: string[],
  method: "GET" | "POST",
) {
  const route = routeFor(scope, segments, method);
  if (!route) return failure(404);

  const binaryEvidence = scope === "support" && method === "GET" &&
    segments[0] === "evidence";
  let page = 1;
  if (method === "GET" && !binaryEvidence) {
    const requestedPage = listPage(request);
    if (requestedPage === null) return failure(400);
    page = requestedPage;
    route.upstream += "?page=" + page;
  } else if (request.nextUrl.searchParams.size) {
    return failure(400);
  }

  if (method === "POST" && !isSameOrigin(request)) return failure(403);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return failure(401);

  let body: string | undefined;
  let key: string | undefined;
  if (method === "POST") {
    key = request.headers.get("Idempotency-Key") ?? undefined;
    if (!commerceId(key) ||
        !request.headers.get("content-type")?.startsWith("application/json"))
      return failure(400);
    try {
      body = await boundedText(request, 16384);
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return failure(400);
    } catch {
      return failure(400);
    }
  }

  const target = hanaAuthApiUrl("/api/v1" + route.upstream);
  if (!target) return failure(503);

  try {
    const upstream = await fetch(target, {
      method,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: binaryEvidence ? "image/*" : "application/json",
        Authorization: `Bearer ${token}`,
        ...(key ? {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        } : {}),
      },
    });

    if (!upstream.ok) {
      const status = [400, 401, 403, 404, 409, 429].includes(upstream.status)
        ? upstream.status : 503;
      let code = "";
      if (upstream.headers.get("content-type")?.includes("application/json")) {
        try {
          const parsed: unknown = JSON.parse(await boundedText(upstream, 4096));
          if (parsed && typeof parsed === "object" &&
              "error" in parsed && typeof parsed.error === "string" &&
              Object.hasOwn(staffMessages, parsed.error))
            code = parsed.error;
        } catch {
          // Never forward arbitrary upstream detail.
        }
      }
      return failure(status, code);
    }

    if (binaryEvidence) {
      const contentType = upstream.headers.get("content-type")?.split(";")[0];
      if (!contentType ||
          !["image/png", "image/jpeg", "image/webp"].includes(contentType))
        return failure(503);
      const bytes = await boundedBytes(upstream, 40000);
      if (bytes.byteLength < 12) return failure(503);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          ...noStore,
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }

    if (upstream.status !== 200 ||
        !upstream.headers.get("content-type")?.includes("application/json"))
      return failure(503);
    const parsed: unknown = JSON.parse(await boundedText(upstream, 512000));
    const result = parseStaffCommerce(
      scope, route.parsePath, method, parsed, page);
    if (result === null) return failure(503);
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return failure(503);
  }
}
