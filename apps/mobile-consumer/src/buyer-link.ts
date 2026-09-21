import {
  type BuyerBrowseLocation, validBrowseSearch,
} from "./buyer-browse-controller.ts";
import { validMobileCatalogId } from "./mobile-catalog.ts";

/**
 * Explicit, unverified custom scheme ALREADY registered in app.json:
 * hana://browse?... or hana://products/{published-id}?...
 *
 * Do not accept arbitrary HTTPS hosts or account/auth paths. Verified
 * Universal Links / Android App Links require future domain ownership,
 * association files and actual native build verification.
 */
export type BuyerLinkRoute =
  | { kind: "browse"; browse: BuyerBrowseLocation }
  | { kind: "detail"; id: string; browse: BuyerBrowseLocation };

export type BuyerLinkEvent = { token: number; route: BuyerLinkRoute };

function browseFromParams(params: URLSearchParams): BuyerBrowseLocation {
  const rawCategory = params.get("categoryId");
  const rawSearch = params.get("search") ?? "";
  const rawPage = params.get("page") ?? "";
  const page = /^[1-9][0-9]{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    categoryId: validMobileCatalogId(rawCategory)
      ? rawCategory.toLowerCase() : null,
    search: validBrowseSearch(rawSearch) ? rawSearch.trim() : "",
    page: page >= 1 && page <= 10000 ? page : 1,
  };
}

export function parseBuyerLink(raw: string | null): BuyerLinkRoute | null {
  if (raw === null || raw.length > 4096) return null;
  let uri: URL;
  try { uri = new URL(raw); }
  catch { return null; }
  if (uri.protocol !== "hana:" || uri.username || uri.password ||
    uri.port || uri.hash || uri.pathname.includes("//")) return null;

  const params = uri.searchParams;
  // Never let duplicate query fields choose differing return-state values.
  for (const key of ["categoryId", "search", "page"]) {
    if (params.getAll(key).length > 1) return null;
  }
  const browse = browseFromParams(params);
  if (uri.hostname === "browse" &&
    (uri.pathname === "" || uri.pathname === "/"))
    return { kind: "browse", browse };
  if (uri.hostname === "products" &&
    /^\/[0-9a-z-]+$/i.test(uri.pathname)) {
    const id = uri.pathname.slice(1);
    if (validMobileCatalogId(id))
      return { kind: "detail", id: id.toLowerCase(), browse };
  }
  return null;
}

export function formatBuyerLink(route: BuyerLinkRoute): string | null {
  if (route.kind === "detail" && !validMobileCatalogId(route.id))
    return null;
  const params = new URLSearchParams();
  const { categoryId, search, page } = route.browse;
  if (categoryId !== null && validMobileCatalogId(categoryId))
    params.set("categoryId", categoryId.toLowerCase());
  if (validBrowseSearch(search) && search.trim())
    params.set("search", search.trim());
  if (Number.isSafeInteger(page) && page > 1 && page <= 10000)
    params.set("page", String(page));
  const path = route.kind === "detail"
    ? "products/" + route.id.toLowerCase() : "browse";
  const query = params.toString();
  return "hana://" + path + (query ? "?" + query : "");
}
