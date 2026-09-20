/**
 * The only allowed consumer API origins. HTTPS is required outside explicit
 * local Expo development; public Expo env must never contain credentials.
 */
export function safeApiBaseUrl(
  raw: string | undefined, allowLocalHttp: boolean,
): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const localHost = ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"]
      .includes(url.hostname);
    if ((url.protocol !== "https:" &&
        !(allowLocalHttp && url.protocol === "http:" && localHost)) ||
        url.username || url.password || url.search || url.hash ||
        url.pathname !== "/" || url.origin === "null")
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
