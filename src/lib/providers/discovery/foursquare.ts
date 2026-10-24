import { NotConfiguredError, providerFetch } from "../http";
import type { DiscoveredPlace, DiscoveryArea, DiscoveryProvider, ProviderInfo } from "../types";

/**
 * Foursquare Places API (2025+ endpoint). Optional, keyed. Used for coverage
 * gaps; we keep only the fsq id plus fields we re-verify, to stay inside
 * commercial terms.
 */
const BASE = "https://places-api.foursquare.com";
const DINING_CATEGORY = "4d4b7105d754a06374d81259"; // Food (top-level category)

interface FsqPlace {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: { address?: string; locality?: string; region?: string; postcode?: string };
  categories?: { name: string }[];
  chains?: { name: string }[];
  tel?: string;
  website?: string;
}

export class FoursquareProvider implements DiscoveryProvider {
  private key = process.env.FOURSQUARE_API_KEY;

  info(): ProviderInfo {
    return {
      id: "foursquare",
      name: "Foursquare Places API",
      kinds: ["discovery"],
      requires: ["FOURSQUARE_API_KEY"],
      configured: !!this.key,
      storable: false,
      licensing: "Commercial API terms; attribution required. Open dataset (FSQ OS Places) is Apache-2.0 if bulk storage is needed.",
      cost: "Pay-as-you-go; ~10k free Pro calls.",
      docsUrl: "https://docs.foursquare.com/fsq-developers-places/reference/place-search",
    };
  }

  async discover(area: DiscoveryArea): Promise<DiscoveredPlace[]> {
    if (!this.key) throw new NotConfiguredError("foursquare", ["FOURSQUARE_API_KEY"]);
    const [s, w, n, e] = area.bbox;
    const params = new URLSearchParams({ ne: `${n},${e}`, sw: `${s},${w}`, fsq_category_ids: DINING_CATEGORY, limit: "50" });
    const res = await providerFetch(`${BASE}/places/search?${params}`, {
      provider: "foursquare",
      headers: { Authorization: `Bearer ${this.key}`, "X-Places-Api-Version": "2025-06-17", Accept: "application/json" },
      rate: { key: "foursquare", perSec: 10, burst: 10 },
    });
    const json = (await res.json()) as { results?: FsqPlace[] };
    return (json.results ?? []).map((p) => ({
      source: "foursquare" as const,
      sourceRef: p.fsq_place_id,
      name: p.name,
      brand: p.chains?.[0]?.name,
      location: { lat: p.latitude, lng: p.longitude },
      address: { line1: p.location?.address, city: p.location?.locality, state: p.location?.region, postalCode: p.location?.postcode },
      phone: p.tel,
      website: p.website,
      cuisine: (p.categories ?? []).map((c) => c.name.toLowerCase()),
      deliveryTag: "unknown" as const,
      takeawayTag: "unknown" as const,
    }));
  }
}
