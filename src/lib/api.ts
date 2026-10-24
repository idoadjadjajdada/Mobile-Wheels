import { NextResponse } from "next/server";
import type { z } from "zod";
import { NotConfiguredError, ProviderError } from "./providers/http";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 1_500_000) return { ok: false, res: error(413, "Request too large") };
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: error(400, "Invalid JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, res: error(400, "Invalid request", { issues: parsed.error.issues.slice(0, 5) }) };
  return { ok: true, data: parsed.data };
}

export function handleError(err: unknown) {
  if (err instanceof NotConfiguredError) return error(503, err.message, { provider: err.provider, notConfigured: true });
  if (err instanceof ProviderError) return error(502, `Upstream provider error (${err.provider})`, { provider: err.provider, retryable: err.retryable });
  console.error(err);
  return error(500, "Something went wrong");
}

/** Simple fixed-window limiter per IP for public endpoints (per instance). */
const hits = new Map<string, { n: number; reset: number }>();
export function limited(req: Request, key: string, max: number, windowMs = 60_000): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || h.reset < now) {
    hits.set(k, { n: 1, reset: now + windowMs });
    if (hits.size > 10_000) for (const [kk, v] of hits) if (v.reset < now) hits.delete(kk);
    return null;
  }
  if (++h.n > max) return error(429, "Too many requests", { retryAfterSeconds: Math.ceil((h.reset - now) / 1000) });
  return null;
}
