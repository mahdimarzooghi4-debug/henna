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
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export const accessTokenPattern = /^hn1_[A-Za-z0-9_-]{43}$/;
export const challengeIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
