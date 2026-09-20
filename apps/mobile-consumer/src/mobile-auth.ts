import { isValidIranianMobile, normalizeDigits, normalizeIranianMobile } from "./phone.ts";

// The bearer is opaque and must only be persisted by the native SecureStore adapter.
// No token is returned to React state, UI, logs or public environment variables.
export interface TokenStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  remove(): Promise<void>;
}

type Failure = "invalid" | "limited" | "unavailable";
type Session = { status: "authenticated"; accountId: string } |
  { status: "guest" | "unavailable" };
type OtpRequest = { status: "accepted"; challengeId: string } |
  { status: Failure };
type Verify = { status: "authenticated"; accountId: string } |
  { status: Failure };
type SignOut = { status: "signedOut" | "unavailable" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^hn1_[A-Za-z0-9_-]{43}$/;
const otpPattern = /^[0-9]{6}$/;
const maximumSessionMilliseconds = 86_400_000;

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : null;
}

function safeBaseUrl(raw: string | undefined, allowLocalHttp: boolean): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const localHost = ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(url.hostname);
    if ((url.protocol !== "https:" &&
        !(allowLocalHttp && url.protocol === "http:" && localHost)) ||
        url.username || url.password || url.search || url.hash ||
        url.pathname !== "/" || url.origin === "null") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** API transport is injectable solely to test the same production behavior in CI. */
export class MobileAuthClient {
  private readonly base: string | null;
  private readonly store: TokenStore;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(
    apiBase: string | undefined,
    store: TokenStore,
    fetchFn: typeof fetch = fetch,
    now: () => number = Date.now,
    allowLocalHttp = false,
  ) {
    this.base = safeBaseUrl(apiBase, allowLocalHttp);
    this.store = store;
    this.fetchFn = fetchFn;
    this.now = now;
  }

  private async send(
    path: string, method: "GET" | "POST" | "DELETE",
    payload?: object, bearer?: string,
  ): Promise<Response | null> {
    if (!this.base) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await this.fetchFn(this.base + path, {
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
          "Cache-Control": "no-store",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async requestOtp(rawPhone: string): Promise<OtpRequest> {
    const phone = normalizeIranianMobile(rawPhone);
    if (!isValidIranianMobile(phone)) return { status: "invalid" };
    const response = await this.send("/api/v1/auth/otp/request", "POST", { phone });
    if (!response) return { status: "unavailable" };
    if (response.status === 400) return { status: "invalid" };
    if (response.status === 429) return { status: "limited" };
    if (response.status !== 202) return { status: "unavailable" };
    try {
      const data = record(await response.json());
      return data && typeof data.challengeId === "string" && uuid.test(data.challengeId)
        ? { status: "accepted", challengeId: data.challengeId }
        : { status: "unavailable" };
    } catch {
      // A bare 202 does not prove an accepted, usable challenge.
      return { status: "unavailable" };
    }
  }

  async verifyOtp(rawPhone: string, challengeId: string, rawCode: string): Promise<Verify> {
    const phone = normalizeIranianMobile(rawPhone);
    const code = normalizeDigits(rawCode.trim());
    if (!isValidIranianMobile(phone) || !uuid.test(challengeId) || !otpPattern.test(code))
      return { status: "invalid" };

    const response = await this.send("/api/v1/auth/otp/verify", "POST",
      { phone, code, challengeId });
    if (!response) return { status: "unavailable" };
    if (response.status === 400 || response.status === 401)
      return { status: "invalid" };
    if (response.status === 429) return { status: "limited" };
    if (response.status !== 200) return { status: "unavailable" };

    let bearer: string;
    let accountId: string;
    try {
      const data = record(await response.json());
      const expiry = typeof data?.expiresAtUtc === "string"
        ? Date.parse(data.expiresAtUtc) : NaN;
      const lifetime = expiry - this.now();
      if (typeof data?.accessToken !== "string" ||
          !tokenPattern.test(data.accessToken) || data.tokenType !== "Bearer" ||
          typeof data.accountId !== "string" || !uuid.test(data.accountId) ||
          !Number.isFinite(lifetime) || lifetime <= 0 ||
          lifetime > maximumSessionMilliseconds)
        return { status: "unavailable" };
      bearer = data.accessToken;
      accountId = data.accountId;
    } catch {
      return { status: "unavailable" };
    }

    try {
      await this.store.write(bearer);
      return { status: "authenticated", accountId };
    } catch {
      // If the OS keystore is unavailable, do not claim that the user signed in.
      // Best-effort revoke the freshly issued server token as it cannot be kept.
      await this.send("/api/v1/auth/session", "DELETE", undefined, bearer);
      return { status: "unavailable" };
    }
  }

  async session(): Promise<Session> {
    let bearer: string | null;
    try {
      bearer = await this.store.read();
    } catch {
      return { status: "unavailable" };
    }
    if (!bearer) return { status: "guest" };
    if (!tokenPattern.test(bearer)) {
      try {
        await this.store.remove();
        return { status: "guest" };
      } catch {
        return { status: "unavailable" };
      }
    }

    const response = await this.send("/api/v1/auth/session", "GET", undefined, bearer);
    if (!response) return { status: "unavailable" };
    if (response.status === 401) {
      try {
        await this.store.remove();
        return { status: "guest" };
      } catch {
        return { status: "unavailable" };
      }
    }
    if (response.status !== 200) return { status: "unavailable" };
    try {
      const data = record(await response.json());
      return typeof data?.accountId === "string" && uuid.test(data.accountId)
        ? { status: "authenticated", accountId: data.accountId }
        : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }

  async logout(): Promise<SignOut> {
    let bearer: string | null;
    try {
      bearer = await this.store.read();
    } catch {
      return { status: "unavailable" };
    }
    if (!bearer || !tokenPattern.test(bearer)) {
      try {
        await this.store.remove();
        return { status: "signedOut" };
      } catch {
        return { status: "unavailable" };
      }
    }
    const response = await this.send("/api/v1/auth/session", "DELETE", undefined, bearer);
    // 401 proves there is no active session for this bearer; 503/network does not.
    if (response?.status !== 204 && response?.status !== 401)
      return { status: "unavailable" };
    try {
      await this.store.remove();
      return { status: "signedOut" };
    } catch {
      return { status: "unavailable" };
    }
  }
}
