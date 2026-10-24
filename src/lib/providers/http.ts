/**
 * Shared plumbing for provider adapters: token-bucket rate limiting, timeouts,
 * retries with exponential backoff that honour Retry-After, and a small TTL cache.
 * In-memory state is per server instance — fine for the refresh job and for
 * short-lived response caching; durable state lives in the database.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class NotConfiguredError extends ProviderError {
  constructor(provider: string, envVars: string[]) {
    super(`${provider} is not configured (set ${envVars.join(", ")})`, provider);
    this.name = "NotConfiguredError";
  }
}

export class NotAuthorizedError extends ProviderError {
  constructor(provider: string, what: string) {
    super(`${provider}: ${what} requires an authorized partner integration, which CRAVE does not have.`, provider);
    this.name = "NotAuthorizedError";
  }
}

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

/** Wait until a token is available. `ratePerSec` tokens refill per second, up to `burst`. */
export async function rateLimit(key: string, ratePerSec: number, burst = 1): Promise<void> {
  for (;;) {
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: burst, last: now };
    b.tokens = Math.min(burst, b.tokens + ((now - b.last) / 1000) * ratePerSec);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      buckets.set(key, b);
      return;
    }
    buckets.set(key, b);
    await sleep(Math.ceil(((1 - b.tokens) / ratePerSec) * 1000));
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface FetchOpts extends RequestInit {
  provider: string;
  timeoutMs?: number;
  retries?: number;
  rate?: { key: string; perSec: number; burst?: number };
}

export async function providerFetch(url: string, opts: FetchOpts): Promise<Response> {
  const { provider, timeoutMs = 15_000, retries = 2, rate, ...init } = opts;
  let attempt = 0;
  for (;;) {
    if (rate) await rateLimit(rate.key, rate.perSec, rate.burst);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) {
        throw new ProviderError(`${provider} responded ${res.status}`, provider, res.status, retryable);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : backoff(attempt));
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (attempt >= retries) {
        const msg = (err as Error).name === "AbortError" ? "timed out" : (err as Error).message;
        throw new ProviderError(`${provider} request failed: ${msg}`, provider, undefined, true);
      }
      await sleep(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
    attempt++;
  }
}

function backoff(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

export class TTLCache<V> {
  private store = new Map<string, { v: V; exp: number }>();
  constructor(
    private ttlMs: number,
    private max = 500,
  ) {}
  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.v;
  }
  set(key: string, v: V) {
    if (this.store.size >= this.max) this.store.delete(this.store.keys().next().value as string);
    this.store.set(key, { v, exp: Date.now() + this.ttlMs });
  }
  async wrap(key: string, fn: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const v = await fn();
    this.set(key, v);
    return v;
  }
}

export const USER_AGENT = `CRAVE/0.1 (+${process.env.NEXT_PUBLIC_SITE_URL ?? "https://github.com"}; ${process.env.CRAVE_CONTACT_EMAIL ?? "set CRAVE_CONTACT_EMAIL"})`;
