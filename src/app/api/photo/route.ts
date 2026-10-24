import { error, limited } from "@/lib/api";

/**
 * Proxies Google Places photo media so the API key never reaches the client.
 * Nothing is stored; responses pass through with a short private cache header.
 */
export async function GET(req: Request) {
  const rl = limited(req, "photo", 120);
  if (rl) return rl;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!key) return error(404, "Photos not configured");
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return error(400, "Invalid photo reference");
  const upstream = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&key=${key}`);
  if (!upstream.ok || !upstream.body) return error(502, "Photo unavailable");
  return new Response(upstream.body, {
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=600" },
  });
}
