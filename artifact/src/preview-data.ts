import { CHAINS } from "@/lib/catalog/chains";
import { MARKET_BY_ID } from "@/lib/catalog/markets";
import { CATALOG_ITEMS } from "@/lib/catalog/menu";
import { DEMO_ITEMS, DEMO_LISTINGS, DEMO_RESTAURANTS } from "@/lib/demo/data";
import type { DeliveryListing, MenuItem, Restaurant } from "@/lib/types";

/**
 * Data for the static preview. Two sources, never mixed:
 *  - "chain menus": the real chain catalog, one chain-wide entry per chain (no branch,
 *    address, hours or distance — those come from live OpenStreetMap data in the full app).
 *  - "demo": the fictional restaurants, shown under the DEMO banner.
 */

export const MARKET = MARKET_BY_ID.get("tucson")!;

export const CHAIN_RESTAURANTS: Restaurant[] = CHAINS.filter((c) => CATALOG_ITEMS.some((i) => i.chainId === c.id)).map((c) => ({
  id: `chain-${c.id}`,
  marketId: MARKET.id,
  chainId: c.id,
  name: c.name,
  kind: "standard",
  address: {},
  location: MARKET.center,
  cuisine: c.categories,
  priceLevel: c.priceLevel,
  hours: {},
  pickup: "unknown",
  externalIds: {},
  provenance: { source: "catalog", verification: "reported", attribution: "Chain-wide menu, no specific location" },
  status: "active",
  isDemo: false,
  locationless: true,
  updatedAt: "2026-10-01T00:00:00Z",
}));

export interface Dataset {
  restaurants: Restaurant[];
  menus: Map<string, MenuItem[]>;
  listings: Map<string, DeliveryListing[]>;
}

export const CHAIN_SET: Dataset = {
  restaurants: CHAIN_RESTAURANTS,
  menus: new Map(CHAIN_RESTAURANTS.map((r) => [r.id, CATALOG_ITEMS.filter((i) => i.chainId === r.chainId)])),
  listings: new Map(),
};

export const DEMO_SET: Dataset = {
  restaurants: DEMO_RESTAURANTS,
  menus: new Map(DEMO_RESTAURANTS.map((r) => [r.id, DEMO_ITEMS.filter((i) => i.restaurantId === r.id)])),
  listings: new Map(DEMO_RESTAURANTS.map((r) => [r.id, DEMO_LISTINGS.filter((l) => l.restaurantId === r.id)])),
};

export function datasetFor(restaurantId: string): Dataset {
  return restaurantId.startsWith("demo-") ? DEMO_SET : CHAIN_SET;
}
