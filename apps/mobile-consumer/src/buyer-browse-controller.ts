import {
  type CatalogCategory, type CatalogPage, MobileCatalogClient,
} from "./mobile-catalog.ts";

export const BROWSE_PAGE_SIZE = 20;

export type BrowseLoad<T> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; data: T };

export type BuyerBrowseState = {
  categories: BrowseLoad<CatalogCategory[]>;
  products: BrowseLoad<CatalogPage>;
  categoryId: string | null;
  search: string;
  page: number;
  /** True only after a confirmed published-category response removed a saved filter. */
  categoryRecovery: boolean;
};

export type BuyerBrowseLocation = {
  categoryId: string | null;
  search: string;
  page: number;
};

export const initialBuyerBrowseState = (
  location: BuyerBrowseLocation = { categoryId: null, search: "", page: 1 },
): BuyerBrowseState => ({
  categories: { status: "loading" },
  products: { status: "loading" },
  categoryId: location.categoryId,
  search: location.search,
  page: location.page,
  categoryRecovery: false,
});

export function validBrowseSearch(text: string): boolean {
  return text.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(text);
}

/**
 * Shipping Expo screen's public-catalog coordinator, independent of OTP.
 * Every query invalidates the preceding visible page and aborts its request.
 * Late results (including malformed responses) can never restore stale UI.
 */
export class BuyerBrowseController {
  private state: BuyerBrowseState;
  private active = false;
  private categoryRequest: AbortController | null = null;
  private productRequest: AbortController | null = null;

  private readonly catalog: MobileCatalogClient;
  private readonly publish: (state: BuyerBrowseState) => void;

  constructor(
    catalog: MobileCatalogClient,
    publish: (state: BuyerBrowseState) => void,
    initial?: BuyerBrowseLocation,
  ) {
    this.catalog = catalog;
    this.publish = publish;
    this.state = initialBuyerBrowseState(initial);
  }

  snapshot(): BuyerBrowseState { return this.state; }

  private update(patch: Partial<BuyerBrowseState>) {
    this.state = { ...this.state, ...patch };
    this.publish(this.state);
  }

  start() {
    if (this.active) return;
    this.active = true;
    void this.refreshCategories();
    void this.refreshProducts();
  }

  stop() {
    this.active = false;
    this.categoryRequest?.abort();
    this.productRequest?.abort();
    this.categoryRequest = null;
    this.productRequest = null;
  }

  async refreshCategories(): Promise<void> {
    if (!this.active) return;
    this.categoryRequest?.abort();
    const request = new AbortController();
    this.categoryRequest = request;
    this.update({ categories: { status: "loading" } });
    const result = await this.catalog.categories(request.signal);
    if (!this.active || request.signal.aborted ||
      this.categoryRequest !== request) return;
    if (result.status !== "ok") {
      this.update({ categories: { status: "unavailable" } });
      return;
    }
    // A fresh publication list may have removed the previously selected ID.
    // Do not keep filtering on an unlisted category or invent its replacement.
    const selected = this.state.categoryId;
    const published = selected === null ? null : result.data.find(
      item => item.id.toLowerCase() === selected.toLowerCase(),
    );
    if (selected !== null && !published) {
      // The old page must not be shown as an unfiltered result while a new
      // query is pending. 503/malformed category replies never enter here.
      this.productRequest?.abort();
      this.update({
        categories: { status: "ok", data: result.data },
        categoryId: null, page: 1, categoryRecovery: true,
        products: { status: "loading" },
      });
      await this.refreshProducts();
      return;
    }
    this.update({
      categories: { status: "ok", data: result.data },
      // Canonicalize a case-insensitive UUID from a cold link for chip state.
      ...(published ? { categoryId: published.id } : {}),
    });
  }

  async refreshProducts(): Promise<void> {
    if (!this.active) return;
    this.productRequest?.abort();
    const request = new AbortController();
    this.productRequest = request;
    const { page, categoryId, search } = this.state;
    this.update({ products: { status: "loading" } });
    const result = await this.catalog.list({
      page, pageSize: BROWSE_PAGE_SIZE,
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { search } : {}),
    }, request.signal);
    if (!this.active || request.signal.aborted ||
      this.productRequest !== request) return;
    // The public client's shape checks do not compare to the request.
    // Refuse a valid-looking page for a different query/page size.
    if (result.status !== "ok" ||
      result.data.page !== page || result.data.pageSize !== BROWSE_PAGE_SIZE) {
      this.update({ products: { status: "unavailable" } });
      return;
    }
    this.update({ products: { status: "ok", data: result.data } });
  }

  /**
   * Apply a validated incoming custom-scheme link without treating the old
   * page as a result of the new query. A removed category cannot be selected
   * when the current published categories response is already known.
   */
  restoreLocation(location: BuyerBrowseLocation): void {
    if (!this.active) return;
    const published = location.categoryId !== null &&
      this.state.categories.status === "ok"
      ? this.state.categories.data.find(item =>
          item.id.toLowerCase() === location.categoryId!.toLowerCase())
      : undefined;
    const removed = location.categoryId !== null &&
      this.state.categories.status === "ok" && !published;
    // While categories are loading/unavailable, keep the selected filter.
    // Only a verified published list can prove an old link is outdated.
    const categoryId = removed ? null : (published?.id ?? location.categoryId);
    const page = removed ? 1 : location.page;
    this.productRequest?.abort();
    this.update({ categoryId, search: location.search, page,
      categoryRecovery: removed, products: { status: "loading" } });
    void this.refreshProducts();
  }

  chooseCategory(id: string | null): boolean {
    if (!this.active || this.state.categories.status !== "ok" ||
      (id !== null && !this.state.categories.data.some((x) => x.id === id)))
      return false;
    if (id === this.state.categoryId && this.state.page === 1) {
      this.update({ categoryRecovery: false });
      return true;
    }
    this.update({ categoryId: id, page: 1, categoryRecovery: false });
    void this.refreshProducts();
    return true;
  }

  submitSearch(input: string): boolean {
    if (!this.active || !validBrowseSearch(input)) return false;
    const search = input.trim();
    if (search === this.state.search && this.state.page === 1) {
      this.update({ categoryRecovery: false });
      void this.refreshProducts();
      return true;
    }
    this.update({ search, page: 1, categoryRecovery: false });
    void this.refreshProducts();
    return true;
  }

  previousPage(): boolean {
    if (!this.active || this.state.products.status !== "ok" ||
      this.state.page <= 1) return false;
    this.update({ page: this.state.page - 1, categoryRecovery: false });
    void this.refreshProducts();
    return true;
  }

  nextPage(): boolean {
    if (!this.active || this.state.products.status !== "ok" ||
      this.state.page >= 10000 ||
      this.state.page * BROWSE_PAGE_SIZE >= this.state.products.data.total)
      return false;
    this.update({ page: this.state.page + 1, categoryRecovery: false });
    void this.refreshProducts();
    return true;
  }
}
