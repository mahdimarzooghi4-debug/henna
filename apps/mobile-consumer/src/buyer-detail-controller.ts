import {
  type CatalogProduct, MobileCatalogClient,
} from "./mobile-catalog.ts";

export type BuyerDetailState =
  | { status: "loading"; id: string }
  | { status: "missing"; id: string }
  | { status: "unavailable"; id: string }
  | { status: "ok"; id: string; product: CatalogProduct };

/**
 * No cached browse card becomes confirmed detail content.
 * Guard both superseded requests and out-of-order upstream responses.
 */
export class BuyerDetailController {
  private readonly catalog: MobileCatalogClient;
  private readonly publish: (state: BuyerDetailState) => void;
  private currentId: string;
  private active = false;
  private request: AbortController | null = null;
  private state: BuyerDetailState;

  constructor(
    catalog: MobileCatalogClient,
    publish: (state: BuyerDetailState) => void,
    id: string,
  ) {
    this.catalog = catalog;
    this.publish = publish;
    this.currentId = id;
    this.state = { status: "loading", id };
  }

  snapshot(): BuyerDetailState { return this.state; }

  private update(state: BuyerDetailState): void {
    this.state = state;
    this.publish(state);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    void this.refresh();
  }

  stop(): void {
    this.active = false;
    this.request?.abort();
    this.request = null;
  }

  open(id: string): void {
    if (!this.active) return;
    this.currentId = id;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.active) return;
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const id = this.currentId;
    this.update({ status: "loading", id });

    const result = await this.catalog.detail(id, request.signal);
    if (!this.active || this.request !== request ||
      request.signal.aborted || this.currentId !== id) return;
    if (result.status === "invalid" || result.status === "notFound") {
      this.update({ status: "missing", id });
    } else if (result.status !== "ok" ||
      result.data.id.toLowerCase() !== id.toLowerCase()) {
      this.update({ status: "unavailable", id });
    } else {
      this.update({ status: "ok", id, product: result.data });
    }
  }
}
