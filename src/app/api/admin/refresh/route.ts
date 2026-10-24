import { z } from "zod";
import { error, json, parseBody } from "@/lib/api";
import { withAdmin } from "@/lib/auth/with-admin";
import { MARKET_BY_ID } from "@/lib/catalog/markets";
import { getRepo } from "@/lib/db";
import { providers } from "@/lib/providers/registry";
import { refreshMarket } from "@/lib/refresh";

export const maxDuration = 300;

const schema = z.object({ marketId: z.string(), source: z.enum(["osm", "foursquare", "google"]).default("osm"), brandsOnly: z.boolean().default(true) });

export const POST = withAdmin(async (req) => {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  const market = MARKET_BY_ID.get(body.data.marketId);
  if (!market) return error(404, "Unknown market");
  const provider = body.data.source === "google" ? providers.google : body.data.source === "foursquare" ? providers.foursquare : providers.osm;
  if (!provider.info().configured) return error(503, `${provider.info().name} is not configured (${provider.info().requires.join(", ")})`);
  const res = await refreshMarket(getRepo(), market, provider, { trigger: "manual", brandsOnly: body.data.brandsOnly });
  return json(res, { status: res.status === "failed" ? 502 : 200 });
});
