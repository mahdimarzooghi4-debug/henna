/** Server only: the bearer secret must never be exposed to client JavaScript. */
export const sessionCookieName =
  process.env.NODE_ENV === "production" ? "__Host-hana_session" : "hana_session";

export const noStore = { "Cache-Control": "no-store" };

export function hanaAuthApiUrl(path: string): URL | null {
  const base = process.env.HANA_API_BASE_URL?.trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (!["https:", "http:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
      url.username || url.password || url.search || url.hash) return null;
    return new URL(path, url);
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const submitted = new URL(origin);
    const url = new URL(request.url);
    const host = request.headers.get("host");
    // Next can normalize request.url to localhost inside a proxy, while
    // the Host header retains the browser-visible authority. Require BOTH
    // the browser Origin and public Host to agree; never trust arbitrary
    // x-forwarded-host or x-forwarded-proto request headers.
    return Boolean(host) &&
      submitted.origin === `${submitted.protocol}//${host}` &&
      submitted.protocol === url.protocol &&
      submitted.pathname === "/" &&
      submitted.search === "" &&
      submitted.hash === "";
  } catch {
    return false;
  }
}

export const accessTokenPattern = /^hn1_[A-Za-z0-9_-]{43}$/;
export const challengeIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
