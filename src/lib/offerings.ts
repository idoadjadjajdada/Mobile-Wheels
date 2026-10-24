import { CHAIN_BY_ID } from "./catalog/chains";
import { getHoursStatus, hasHours } from "./hours";
import { valueScore } from "./pricing";
import { DELIVERY_PLATFORMS, deliveryAdapters } from "./providers/registry";
import { buildTasteModel, diversify, exclusionFor, type ExclusionReason, scoreOffering } from "./ranking";
import type { Chain, DeliveryListing, HoursSet, ListingView, Market, MenuItem, Offering, PreferenceState, Promotion, Restaurant } from "./types";

/**
 * Turning restaurants + menus + listings into ranked swipe cards. No I/O, so the
 * server (discovery.ts) and the in-browser preview build share it.
 */

/** True only when an authorized adapter can report live delivery acceptance. None can today. */
export function liveDeliveryVerificationAvailable() {
  return Object.values(deliveryAdapters).some((a) => a.capabilities().liveQuote && a.info().configured && !a.info().disabledReason);
}

export function listingViews(r: Restaurant, chain: Chain | undefined, stored: DeliveryListing[]): ListingView[] {
  const out: ListingView[] = [];
  for (const platform of DELIVERY_PLATFORMS) {
    const adapter = deliveryAdapters[platform];
    const caps = adapter.capabilities();
    const listing = stored.find((l) => l.platform === platform);
    // Virtual brands and delivery-only kitchens don't have a walk-in "direct" option unless an admin added one.
    if (platform === "direct" && !listing && (r.kind === "virtual_brand" || r.kind === "ghost_kitchen") ) continue;
    const url = adapter.orderUrl(r, listing, chain);
    const urlKind: ListingView["urlKind"] = !url
      ? "none"
      : listing?.storeUrl
        ? listing.listingStatus === "verified_listed" || platform === "direct"
          ? "verified_store"
          : "store"
        : platform === "direct"
          ? "direct_site"
          : "search";
    if (platform === "direct" && !listing && !url) continue;
    const base: DeliveryListing = listing ?? {
      id: `synthetic:${r.id}:${platform}`,
      restaurantId: r.id,
      platform,
      listingStatus: "unknown",
      offersDelivery: "unknown",
      offersPickup: platform === "direct" ? r.pickup : "unknown",
      provenance: { source: "catalog", verification: "unknown" },
    };
    out.push({
      ...base,
      platformLabel: base.platformLabel ?? adapter.label,
      synthetic: !listing,
      url,
      urlKind,
      capabilities: { addressCoverage: caps.addressCoverage, liveQuote: caps.liveQuote },
    });
  }
  return out;
}

function hoursFor(r: Restaurant, set: HoursSet | undefined, tz: string, now: Date) {
  return getHoursStatus(set, tz, now, { cutoffMinutes: r.hours.kitchenCutoffMinutes });
}

export function buildOfferings(
  rows: { restaurant: Restaurant; distanceKm: number }[],
  menus: Map<string, MenuItem[]>,
  listings: Map<string, DeliveryListing[]>,
  promos: Map<string, Promotion[]>,
  market: Market,
  now: Date,
  state: PreferenceState,
): Offering[] {
  const out: Offering[] = [];
  for (const { restaurant: r, distanceKm } of rows) {
    const chain = r.chainId ? CHAIN_BY_ID.get(r.chainId) : undefined;
    const views = listingViews(r, chain, listings.get(r.id) ?? []);
    const hours = hoursFor(r, r.hours.general, market.timezone, now);
    const deliveryHours = hasHours(r.hours.delivery) ? hoursFor(r, r.hours.delivery, market.timezone, now) : undefined;
    const rPromos = promos.get(r.id) ?? [];
    for (const item of menus.get(r.id) ?? []) {
      out.push({
        key: `${r.id}:${item.id}`,
        item,
        restaurant: r,
        chain,
        distanceKm: Math.round(distanceKm * 100) / 100,
        hours,
        deliveryHours,
        listings: views,
        promotions: rPromos,
        value: valueScore(item, state.profile),
        score: 0,
        reasons: [],
      });
    }
  }
  return out;
}

/** Apply product rules + user filters, score, sort and diversify. */
export function rankDeck(all: Offering[], state: PreferenceState, market: Market, now: Date, liveDeliveryVerification: boolean, limit = 60) {
  const ctx = { state, market, now, liveDeliveryVerification };
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const model = buildTasteModel(state.swipes, now);
  const kept: Offering[] = [];
  for (const o of all) {
    const ex = exclusionFor(o, ctx);
    if (ex) {
      excluded[ex.reason] = (excluded[ex.reason] ?? 0) + 1;
      continue;
    }
    const s = scoreOffering(o, state, model, now);
    kept.push({ ...o, score: s.score, reasons: s.reasons });
  }
  kept.sort((a, b) => b.score - a.score);
  return { offerings: diversify(kept).slice(0, limit), excluded };
}
