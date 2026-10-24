/**
 * In-browser stand-in for src/lib/client/api.ts in the static preview. Same
 * exports and shapes; the deck, details and ranking run the app's real code
 * (offerings.ts, ranking.ts, hours.ts, pricing.ts). Anything that needs CRAVE's
 * server says so instead of pretending.
 */
import { CHAIN_BY_ID } from "@/lib/catalog/chains";
import type { DeckMeta, RestaurantDetail } from "@/lib/discovery";
import { haversineKm } from "@/lib/geo";
import { getHoursStatus, hasHours, upcomingSpecialHours, weeklySchedule } from "@/lib/hours";
import { buildOfferings, listingViews, rankDeck } from "@/lib/offerings";
import { buildTasteModel, scoreOffering } from "@/lib/ranking";
import type { LatLng, Offering, PreferenceState, Promotion, Restaurant } from "@/lib/types";
import { CHAIN_SET, DEMO_SET, MARKET, datasetFor, type Dataset } from "./preview-data";

export type { DeckMeta, RestaurantDetail };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const NEEDS_SERVER = (what: string) => new ApiError(`${what} needs the full CRAVE app. This preview runs entirely in your browser with no server.`, 503);

const marketInfo = { id: MARKET.id, name: MARKET.name, timezone: MARKET.timezone, taxRate: MARKET.taxRate };

function rows(set: Dataset, point: LatLng | undefined) {
  return set.restaurants.map((restaurant) => ({
    restaurant,
    distanceKm: restaurant.locationless || !point ? 0 : haversineKm(point, restaurant.location),
  }));
}

function allOfferings(set: Dataset, point: LatLng | undefined, state: PreferenceState, now: Date): Offering[] {
  return buildOfferings(rows(set, point), set.menus, set.listings, new Map<string, Promotion[]>(), MARKET, now, state);
}

function scored(list: Offering[], state: PreferenceState, now: Date) {
  const model = buildTasteModel(state.swipes, now);
  return list.map((o) => {
    const s = scoreOffering(o, state, model, now);
    return { ...o, score: s.score, reasons: s.reasons };
  });
}

const tick = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

export const api = {
  deck: async (point: LatLng, state: PreferenceState) => {
    const now = new Date();
    const set = state.profile.demoMode ? DEMO_SET : CHAIN_SET;
    const all = allOfferings(set, point, state, now);
    const { offerings, excluded } = rankDeck(all, state, MARKET, now, false);
    const meta: DeckMeta = {
      mode: state.profile.demoMode ? "demo" : "live",
      market: marketInfo,
      outsideMarket: false,
      restaurantsConsidered: set.restaurants.length,
      restaurantsWithoutMenu: 0,
      itemsConsidered: all.length,
      excluded,
      liveDeliveryVerification: false,
      storeMode: "local",
      generatedAt: now.toISOString(),
    };
    return tick({ offerings, meta });
  },

  offerings: async (keys: string[], point: LatLng | undefined, state: PreferenceState) => {
    const now = new Date();
    const wanted = new Set(keys);
    const list = [...allOfferings(CHAIN_SET, point, state, now), ...allOfferings(DEMO_SET, point, state, now)].filter((o) => wanted.has(o.key));
    return tick({ offerings: scored(list, state, now) });
  },

  restaurant: async (id: string, point: LatLng | undefined, state: PreferenceState): Promise<RestaurantDetail> => {
    const now = new Date();
    const set = datasetFor(id);
    const r = set.restaurants.find((x) => x.id === id);
    if (!r) throw new ApiError("Restaurant not found", 404);
    const chain = r.chainId ? CHAIN_BY_ID.get(r.chainId) : undefined;
    const tz = MARKET.timezone;
    const offerings = scored(
      allOfferings(set, point, state, now).filter((o) => o.restaurant.id === id),
      state,
      now,
    ).sort((a, b) => b.score - a.score);
    const host: Restaurant | undefined = r.hostRestaurantId ? set.restaurants.find((x) => x.id === r.hostRestaurantId) : undefined;
    const query = encodeURIComponent([r.name, r.address.line1, r.address.city].filter(Boolean).join(", ") || `${r.name} near Tucson, AZ`);
    return tick({
      restaurant: r,
      chain,
      market: marketInfo,
      distanceKm: r.locationless || !point ? undefined : Math.round(haversineKm(point, r.location) * 100) / 100,
      offerings,
      listings: listingViews(r, chain, set.listings.get(id) ?? []),
      hours: {
        general: getHoursStatus(r.hours.general, tz, now, { cutoffMinutes: r.hours.kitchenCutoffMinutes }),
        delivery: hasHours(r.hours.delivery) ? getHoursStatus(r.hours.delivery, tz, now) : undefined,
        pickup: hasHours(r.hours.pickup) ? getHoursStatus(r.hours.pickup, tz, now) : undefined,
        weekly: weeklySchedule(r.hours.general),
        specials: upcomingSpecialHours(r.hours.general, tz, now),
        provenance: r.hours.general?.provenance,
        kitchenCutoffMinutes: r.hours.kitchenCutoffMinutes,
      },
      rating: r.rating,
      host: host ? { id: host.id, name: host.name } : undefined,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
  },

  geocode: async (_q: string): Promise<{ results: { label: string; point: LatLng; precision: string }[] }> => {
    throw NEEDS_SERVER("Address search");
  },
  reverse: async (_p: LatLng) => ({ label: null as string | null }),
  report: async (_r: { restaurantId?: string; menuItemId?: string; kind: string; message?: string }): Promise<{ ok: true }> => {
    throw NEEDS_SERVER("Sending reports to the review queue");
  },
  status: async () => ({ store: "local" as const, auth: false, liveDeliveryVerification: false }),
  createGroup: async (_b: { name: string; memberId: string; displayName: string; center?: LatLng }): Promise<{ code: string }> => {
    throw NEEDS_SERVER("Group mode (friends' swipes meet on CRAVE's server)");
  },
  joinGroup: async (_code: string, _b: { memberId: string; displayName: string }): Promise<{ ok: true; code: string; center?: LatLng }> => {
    throw NEEDS_SERVER("Group mode");
  },
  group: async (
    _code: string,
    _memberId: string,
  ): Promise<{
    code: string;
    name: string;
    center?: LatLng;
    expiresAt: string;
    members: { displayName: string; isMe: boolean; swipes: number }[];
    matches: string[];
    restaurantMatches: string[];
    mySwipes: string[];
  }> => {
    throw NEEDS_SERVER("Group mode");
  },
  groupSwipe: async (_code: string, _b: { memberId: string; offeringKey: string; restaurantId: string; action: string }): Promise<{ ok: true }> => {
    throw NEEDS_SERVER("Group mode");
  },
};
