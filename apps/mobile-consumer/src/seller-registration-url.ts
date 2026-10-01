/** Build the public web registration URL without accepting arbitrary schemes. */
export function sellerRegistrationUrl(
  webBaseUrl: string | undefined,
  allowLocalHttp = false,
): string | null {
  if (!webBaseUrl?.trim()) return null;
  try {
    const base = new URL(webBaseUrl);
    const local = base.hostname === "localhost" ||
      base.hostname === "127.0.0.1" || base.hostname === "10.0.2.2";
    if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== "https:" && !(allowLocalHttp && local && base.protocol === "http:")))
      return null;
    return new URL("/seller/register", base.origin).toString();
  } catch {
    return null;
  }
}
