import { parseBuyerLink } from "./buyer-link.ts";

export class BuyerLinkInbox {
  private buffered: string | null = null;
  private consumer: ((url: string) => void) | null = null;

  offer(raw: string): boolean {
    if (parseBuyerLink(raw) === null) return false;
    if (this.consumer !== null) this.consumer(raw);
    else this.buffered = raw;
    return true;
  }

  take(): string | null {
    const value = this.buffered;
    this.buffered = null;
    return value;
  }

  clear(): void {
    this.buffered = null;
  }

  subscribe(consumer: (url: string) => void): () => void {
    this.consumer = consumer;
    const buffered = this.take();
    if (buffered !== null) consumer(buffered);
    return () => {
      if (this.consumer === consumer) this.consumer = null;
    };
  }
}
