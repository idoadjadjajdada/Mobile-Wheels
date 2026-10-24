/**
 * Run a market refresh from the command line.
 *   npm run refresh -- --market tucson [--brands-only] [--limit 200] [--source osm|foursquare|google]
 * Writes to Supabase when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, else the local dev store.
 */
import { MARKET_BY_ID } from "../src/lib/catalog/markets";
import { LocalRepository } from "../src/lib/db/local";
import { SupabaseRepository } from "../src/lib/db/supabase";
import { providers } from "../src/lib/providers/registry";
import { refreshMarket } from "../src/lib/refresh";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const marketId = opt("market") ?? "tucson";
  const market = MARKET_BY_ID.get(marketId);
  if (!market) throw new Error(`Unknown market ${marketId}`);
  const source = opt("source") ?? "osm";
  const provider = source === "google" ? providers.google : source === "foursquare" ? providers.foursquare : providers.osm;
  const repo =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseRepository(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : new LocalRepository();
  console.log(`Refreshing ${market.name} from ${provider.info().name} into ${repo.mode} store…`);
  const res = await refreshMarket(repo, market, provider, {
    trigger: "cli",
    brandsOnly: flag("brands-only"),
    limit: opt("limit") ? Number(opt("limit")) : undefined,
  });
  console.log(res.status, res.stats);
  if (res.error) {
    console.error(res.error);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
