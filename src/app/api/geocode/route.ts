import { error, json, limited } from "@/lib/api";
import { geocodeWithFallback } from "@/lib/providers/geocoding";
import { geocoders } from "@/lib/providers/registry";

export async function GET(req: Request) {
  const rl = limited(req, "geocode", 30);
  if (rl) return rl;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 4 || q.length > 200) return error(400, "Enter a street address");
  const { results, errors } = await geocodeWithFallback(q, geocoders);
  if (!results.length && errors.length) return error(502, "Address lookup is unavailable right now. Try again shortly.", { errors });
  return json({ results: results.slice(0, 5) });
}
