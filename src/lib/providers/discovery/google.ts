import type { HoursSet, Rating, Restaurant, WeeklyPeriod } from "../../types";
import { NotConfiguredError, providerFetch, TTLCache } from "../http";
import type { DiscoveredPlace, DiscoveryArea, DiscoveryProvider, ProviderInfo, RatingsProvider } from "../types";

/**
 * Google Places API (New). Optional, keyed, billed.
 *
 * Terms: we may store `place_id` indefinitely but must not store other Places
 * content. So this adapter is used for *live enrichment* (ratings, current
 * hours incl. special days, photos) with only a short transient cache, and
 * discovery results are only used to attach place IDs to existing records.
 */

const BASE = "https://places.googleapis.com/v1";
const FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "websiteUri",
  "regularOpeningHours",
  "currentOpeningHours",
  "photos",
  "businessStatus",
];

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  businessStatus?: string;
  regularOpeningHours?: { periods?: GPeriod[] };
  currentOpeningHours?: { periods?: GPeriod[]; specialDays?: { date: { year: number; month: number; day: number } }[] };
  photos?: { name: string; widthPx: number; heightPx: number; authorAttributions?: { displayName: string; uri?: string }[] }[];
}

interface GPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

const live = new TTLCache<GooglePlace | null>(10 * 60_000, 1000);

const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function googlePeriodsToWeekly(periods: GPeriod[] = []): WeeklyPeriod[] {
  // A single period with open at day 0 00:00 and no close means open 24/7.
  if (periods.length === 1 && !periods[0].close) {
    return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "00:00", close: "24:00" }));
  }
  return periods
    .filter((p) => p.close)
    .map((p) => ({ day: p.open.day, open: hhmm(p.open.hour, p.open.minute), close: hhmm(p.close!.hour, p.close!.minute) }));
}

export class GooglePlacesProvider implements DiscoveryProvider, RatingsProvider {
  private key = process.env.GOOGLE_PLACES_API_KEY;

  info(): ProviderInfo {
    return {
      id: "google_places",
      name: "Google Places API (New)",
      kinds: ["discovery", "ratings", "imagery"],
      requires: ["GOOGLE_PLACES_API_KEY"],
      configured: !!this.key,
      storable: false,
      licensing: "Google Maps Platform ToS: store place_id only; show attributions; no pre-fetching or caching of content.",
      cost: "Pay-as-you-go with ~10k free billable events per SKU per month; Pro/Enterprise SKUs roughly $20–40 per 1k.",
      docsUrl: "https://developers.google.com/maps/documentation/places/web-service/op-overview",
    };
  }

  private headers(fields: string[]) {
    if (!this.key) throw new NotConfiguredError("google_places", ["GOOGLE_PLACES_API_KEY"]);
    return { "X-Goog-Api-Key": this.key, "X-Goog-FieldMask": fields.join(","), "Content-Type": "application/json" };
  }

  async discover(area: DiscoveryArea): Promise<DiscoveredPlace[]> {
    const [s, w, n, e] = area.bbox;
    const res = await providerFetch(`${BASE}/places:searchNearby`, {
      provider: "google_places",
      method: "POST",
      headers: this.headers(FIELDS.map((f) => `places.${f}`)),
      body: JSON.stringify({
        includedTypes: ["restaurant", "fast_food_restaurant"],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: (s + n) / 2, longitude: (w + e) / 2 },
            radius: Math.min(50_000, ((n - s) * 111_000) / 2),
          },
        },
      }),
      rate: { key: "google-places", perSec: 5, burst: 5 },
    });
    const json = (await res.json()) as { places?: GooglePlace[] };
    // Only the place_id is retained downstream (raw is intentionally omitted).
    return (json.places ?? []).map((p) => ({
      source: "google_places" as const,
      sourceRef: p.id,
      name: p.displayName?.text ?? "",
      location: { lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0 },
      address: { line1: p.formattedAddress },
      cuisine: [],
      deliveryTag: "unknown" as const,
      takeawayTag: "unknown" as const,
    }));
  }

  /** Resolve a Google place for a restaurant (by stored place_id, else a text search). */
  async placeFor(r: Restaurant): Promise<GooglePlace | null> {
    if (!this.key) return null;
    const cacheKey = r.externalIds.google ?? `${r.name}|${r.location.lat.toFixed(4)},${r.location.lng.toFixed(4)}`;
    return live.wrap(cacheKey, async () => {
      if (r.externalIds.google) {
        const res = await providerFetch(`${BASE}/places/${encodeURIComponent(r.externalIds.google)}`, {
          provider: "google_places",
          headers: this.headers(FIELDS),
          rate: { key: "google-places", perSec: 5, burst: 5 },
        });
        return (await res.json()) as GooglePlace;
      }
      const res = await providerFetch(`${BASE}/places:searchText`, {
        provider: "google_places",
        method: "POST",
        headers: this.headers(FIELDS.map((f) => `places.${f}`)),
        body: JSON.stringify({
          textQuery: [r.name, r.address.line1, r.address.city].filter(Boolean).join(", "),
          maxResultCount: 1,
          locationBias: { circle: { center: { latitude: r.location.lat, longitude: r.location.lng }, radius: 200 } },
        }),
        rate: { key: "google-places", perSec: 5, burst: 5 },
      });
      const json = (await res.json()) as { places?: GooglePlace[] };
      return json.places?.[0] ?? null;
    });
  }

  async ratingFor(r: Restaurant): Promise<Rating | undefined> {
    const p = await this.placeFor(r);
    if (!p?.rating) return undefined;
    return { value: p.rating, count: p.userRatingCount, source: "google_places", url: p.googleMapsUri, fetchedAt: new Date().toISOString() };
  }

  async liveHours(r: Restaurant): Promise<HoursSet | undefined> {
    const p = await this.placeFor(r);
    const periods = p?.currentOpeningHours?.periods ?? p?.regularOpeningHours?.periods;
    if (!periods?.length) return undefined;
    return {
      regular: googlePeriodsToWeekly(p?.regularOpeningHours?.periods ?? periods),
      special: [],
      provenance: { source: "google_places", verification: "reported", fetchedAt: new Date().toISOString(), attribution: "Google" },
    };
  }
}
