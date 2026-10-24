import { error, json, limited } from "@/lib/api";
import { providers } from "@/lib/providers/registry";

/** Reverse geocode for a human label only; the precise point stays on the device unless the user saves it. */
export async function GET(req: Request) {
  const rl = limited(req, "reverse", 20);
  if (rl) return rl;
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return error(400, "Invalid coordinates");
  try {
    const r = await providers.nominatim.reverse({ lat, lng });
    return json({ label: r?.label ?? null });
  } catch {
    return json({ label: null });
  }
}
