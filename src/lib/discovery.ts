import "server-only";
import { CHAIN_BY_ID } from "./catalog/chains";
import { MARKET_BY_ID, marketForPoint } from "./catalog/markets";
import { getRepo } from "./db";
import { DEMO_ITEMS, DEMO_LISTINGS, DEMO_RESTAURANTS } from "./demo/data";
import { haversineKm } from "./geo";
import { getHoursStatus, hasHours, upcomingSpecialHours, weeklySchedule } from "./hours";
import { buildOfferings, listingViews, liveDeliveryVerificationAvailable, rankDeck } from "./offerings";
import { providers } from "./providers/registry";
import { buildTasteModel, type ExclusionReason, scoreOffering } from "./ranking";
export { liveDeliveryVerificationAvailable };

import type {
  Chain,
  DeliveryListing,
  HoursSet,
  LatLng,
  ListingView,
  MenuItem,
  Offering,
  PreferenceState,
  Promotion,
  Rating,
  Restaurant,
} from "./types";

export interface DeckMeta {
  mode: "live" | "demo";
  market?: { id: string; name: string; timezone: string; taxRate: number };
  outsideMarket: boolean;
  restaurantsConsidered: number;
  restaurantsWithoutMenu: number;
  itemsConsidered: number;
  excluded: Partial<Record<ExclusionReason, number>>;
  liveDeliveryVerification: boolean;
  storeMode: "supabase" | "local";
  generatedAt: string;
}

async function loadArea(point: LatLng, radiusKm: number, demo: boolean) {
  if (demo) {
    const rows = DEMO_RESTAURANTS.map((restaurant) => ({ restaurant, distanceKm: haversineKm(point, restaurant.location) }));
    const menus = new Map(DEMO_RESTAURANTS.map((r) => [r.id, DEMO_ITEMS.filter((i) => i.restaurantId === r.id)]));
    const listings = new Map(DEMO_RESTAURANTS.map((r) => [r.id, DEMO_LISTINGS.filter((l) => l.restaurantId === r.id)]));
    return { rows, menus, listings, promos: new Map<string, Promotion[]>() };
  }
  const repo = getRepo();
  let rows = await repo.restaurantsNear(point, radiusKm);
  if (rows.length < 15 && radiusKm < 20) rows = await repo.restaurantsNear(point, Math.min(25, radiusKm * 2));
  const [menus, listings, promos] = await Promise.all([
    repo.menuFor(rows.map((x) => x.restaurant)),
    repo.listingsFor(rows.map((x) => x.restaurant.id)),
    repo.promotionsFor(rows.map((x) => x.restaurant)),
  ]);
  return { rows, menus, listings, promos };
}

export async function buildDeck(input: { point: LatLng; state: PreferenceState; now?: Date; limit?: number }): Promise<{ offerings: Offering[]; meta: DeckMeta }> {
  const now = input.now ?? new Date();
  const demo = input.state.profile.demoMode;
  const market = demo ? MARKET_BY_ID.get("tucson")! : marketForPoint(input.point.lat, input.point.lng);
  const repo = getRepo();
  const baseMeta = {
    mode: demo ? ("demo" as const) : ("live" as const),
    liveDeliveryVerification: liveDeliveryVerificationAvailable(),
    storeMode: repo.mode,
    generatedAt: now.toISOString(),
  };
  if (!market) {
    return {
      offerings: [],
      meta: { ...baseMeta, outsideMarket: true, restaurantsConsidered: 0, restaurantsWithoutMenu: 0, itemsConsidered: 0, excluded: {} },
    };
  }

  const radiusKm = Math.max(8, Math.min(25, input.state.filters.maxDistanceKm ?? 10));
  const { rows, menus, listings, promos } = await loadArea(input.point, radiusKm, demo);
  const all = buildOfferings(rows, menus, listings, promos, market, now, input.state);

  const { offerings, excluded } = rankDeck(all, input.state, market, now, baseMeta.liveDeliveryVerification, input.limit);

  return {
    offerings,
    meta: {
      ...baseMeta,
      market: { id: market.id, name: market.name, timezone: market.timezone, taxRate: market.taxRate },
      outsideMarket: false,
      restaurantsConsidered: rows.length,
      restaurantsWithoutMenu: rows.filter((x) => !(menus.get(x.restaurant.id) ?? []).length).length,
      itemsConsidered: all.length,
      excluded,
    },
  };
}

/** Offerings for an explicit list of keys (shortlist, compare, order handoff). Ignores swipe-based exclusions. */
export async function offeringsByKeys(keys: string[], point: LatLng | undefined, state: PreferenceState, now = new Date()): Promise<Offering[]> {
  const byRestaurant = new Map<string, Set<string>>();
  for (const k of keys.slice(0, 100)) {
    const i = k.indexOf(":");
    if (i <= 0) continue;
    const rid = k.slice(0, i);
    byRestaurant.set(rid, (byRestaurant.get(rid) ?? new Set()).add(k.slice(i + 1)));
  }
  const out: Offering[] = [];
  for (const [rid, itemIds] of byRestaurant) {
    const detail = await restaurantBundle(rid, point, state, now);
    if (!detail) continue;
    out.push(...detail.offerings.filter((o) => itemIds.has(o.item.id)));
  }
  return out;
}

async function restaurantBundle(id: string, point: LatLng | undefined, state: PreferenceState, now: Date) {
  const demo = id.startsWith("demo-");
  let restaurant: Restaurant | null;
  let menu: MenuItem[];
  let stored: DeliveryListing[];
  let promos: Promotion[] = [];
  if (demo) {
    restaurant = DEMO_RESTAURANTS.find((r) => r.id === id) ?? null;
    menu = DEMO_ITEMS.filter((i) => i.restaurantId === id);
    stored = DEMO_LISTINGS.filter((l) => l.restaurantId === id);
  } else {
    const repo = getRepo();
    restaurant = await repo.getRestaurant(id);
    if (!restaurant) return null;
    const [menus, listings, pr] = await Promise.all([repo.menuFor([restaurant]), repo.listingsFor([id]), repo.promotionsFor([restaurant])]);
    menu = menus.get(id) ?? [];
    stored = listings.get(id) ?? [];
    promos = pr.get(id) ?? [];
  }
  if (!restaurant) return null;
  const market = MARKET_BY_ID.get(restaurant.marketId) ?? MARKET_BY_ID.get("tucson")!;
  const distanceKm = point ? haversineKm(point, restaurant.location) : 0;
  const offerings = buildOfferings(
    [{ restaurant, distanceKm }],
    new Map([[id, menu]]),
    new Map([[id, stored]]),
    new Map([[id, promos]]),
    market,
    now,
    state,
  );
  const model = buildTasteModel(state.swipes, now);
  for (const o of offerings) {
    const s = scoreOffering(o, state, model, now);
    o.score = s.score;
    o.reasons = s.reasons;
  }
  return { restaurant, market, offerings, stored };
}

export interface RestaurantDetail {
  restaurant: Restaurant;
  chain?: Chain;
  market: { id: string; name: string; timezone: string; taxRate: number };
  distanceKm?: number;
  offerings: Offering[];
  listings: ListingView[];
  hours: {
    general: ReturnType<typeof getHoursStatus>;
    delivery?: ReturnType<typeof getHoursStatus>;
    pickup?: ReturnType<typeof getHoursStatus>;
    weekly: { day: string; text: string }[];
    deliveryWeekly?: { day: string; text: string }[];
    pickupWeekly?: { day: string; text: string }[];
    specials: { date: string; text: string; note?: string }[];
    provenance?: HoursSet["provenance"];
    kitchenCutoffMinutes?: number;
    /** Secondary opinion from Google, shown only if configured; never stored. */
    google?: { weekly: { day: string; text: string }[]; status: ReturnType<typeof getHoursStatus> };
  };
  rating?: Rating;
  host?: { id: string; name: string };
  mapsUrl: string;
}

export async function restaurantDetail(id: string, point: LatLng | undefined, state: PreferenceState, now = new Date()): Promise<RestaurantDetail | null> {
  const bundle = await restaurantBundle(id, point, state, now);
  if (!bundle) return null;
  const { restaurant: r, market, offerings, stored } = bundle;
  const chain = r.chainId ? CHAIN_BY_ID.get(r.chainId) : undefined;
  const tz = market.timezone;

  let rating = r.rating;
  let google: RestaurantDetail["hours"]["google"];
  if (!r.isDemo && providers.google.info().configured) {
    try {
      rating = (await providers.google.ratingFor(r)) ?? rating;
      const gh = await providers.google.liveHours(r);
      if (gh) google = { weekly: weeklySchedule(gh), status: getHoursStatus(gh, tz, now) };
    } catch {
      // Enrichment is best-effort; the page still renders with stored data.
    }
  }

  let host: RestaurantDetail["host"];
  if (r.hostRestaurantId) {
    const h = r.isDemo ? DEMO_RESTAURANTS.find((x) => x.id === r.hostRestaurantId) : await getRepo().getRestaurant(r.hostRestaurantId);
    if (h) host = { id: h.id, name: h.name };
  }

  const query = encodeURIComponent([r.name, r.address.line1, r.address.city].filter(Boolean).join(", "));
  return {
    restaurant: r,
    chain,
    market: { id: market.id, name: market.name, timezone: tz, taxRate: market.taxRate },
    distanceKm: point ? Math.round(haversineKm(point, r.location) * 100) / 100 : undefined,
    offerings: offerings.sort((a, b) => b.score - a.score),
    listings: listingViews(r, chain, stored),
    hours: {
      general: getHoursStatus(r.hours.general, tz, now, { cutoffMinutes: r.hours.kitchenCutoffMinutes }),
      delivery: hasHours(r.hours.delivery) ? getHoursStatus(r.hours.delivery, tz, now) : undefined,
      pickup: hasHours(r.hours.pickup) ? getHoursStatus(r.hours.pickup, tz, now) : undefined,
      weekly: weeklySchedule(r.hours.general),
      deliveryWeekly: hasHours(r.hours.delivery) ? weeklySchedule(r.hours.delivery) : undefined,
      pickupWeekly: hasHours(r.hours.pickup) ? weeklySchedule(r.hours.pickup) : undefined,
      specials: upcomingSpecialHours(r.hours.general, tz, now),
      provenance: r.hours.general?.provenance,
      kitchenCutoffMinutes: r.hours.kitchenCutoffMinutes,
      google,
    },
    rating,
    host,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}${r.externalIds.google ? `&query_place_id=${encodeURIComponent(r.externalIds.google)}` : ""}`,
  };
}
