import { error, json } from "@/lib/api";
import { MARKETS } from "@/lib/catalog/markets";
import { getRepo } from "@/lib/db";
import { providers } from "@/lib/providers/registry";
import { refreshMarket } from "@/lib/refresh";

export const maxDuration = 300;

/**
 * Scheduled refresh (Vercel Cron → GET with `Authorization: Bearer $CRON_SECRET`).
 * Chains only (brands-only) on weekdays, a full sweep on Sundays, to keep load on
 * public Overpass instances modest.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(401, "Unauthorized");
  const full = new Date().getUTCDay() === 0 || new URL(req.url).searchParams.get("full") === "1";
  const results = [];
  for (const market of MARKETS.filter((m) => m.active)) {
    results.push({ market: market.id, ...(await refreshMarket(getRepo(), market, providers.osm, { trigger: "schedule", brandsOnly: !full })) });
  }
  return json({ full, results });
}
