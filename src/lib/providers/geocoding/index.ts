import type { LatLng } from "../../types";
import { providerFetch, TTLCache, USER_AGENT } from "../http";
import type { GeocodeResult, GeocodingProvider, ProviderInfo } from "../types";

const cache = new TTLCache<GeocodeResult[]>(24 * 3_600_000, 2000);

/** US Census Geocoder: keyless, public domain, US street addresses. Default for Tucson. */
export class CensusGeocoder implements GeocodingProvider {
  info(): ProviderInfo {
    return {
      id: "census",
      name: "US Census Geocoder",
      kinds: ["geocoding"],
      requires: [],
      configured: true,
      storable: true,
      licensing: "Public domain (US Government work).",
      cost: "Free.",
      docsUrl: "https://geocoding.geo.census.gov/geocoder/",
    };
  }

  async geocode(query: string): Promise<GeocodeResult[]> {
    return cache.wrap(`census:${query.toLowerCase()}`, async () => {
      const params = new URLSearchParams({ address: query, benchmark: "Public_AR_Current", format: "json" });
      const res = await providerFetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`, {
        provider: "census",
        timeoutMs: 10_000,
        rate: { key: "census", perSec: 5, burst: 5 },
      });
      const json = (await res.json()) as {
        result?: { addressMatches?: { matchedAddress: string; coordinates: { x: number; y: number } }[] };
      };
      return (json.result?.addressMatches ?? []).map((m) => ({
        label: m.matchedAddress,
        point: { lat: m.coordinates.y, lng: m.coordinates.x },
        source: "census" as const,
        precision: "interpolated" as const,
      }));
    });
  }
}

/** Nominatim (OSM). 1 req/s, identifying User-Agent, no bulk. Fallback + reverse geocoding. */
export class NominatimGeocoder implements GeocodingProvider {
  private base = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";

  info(): ProviderInfo {
    return {
      id: "nominatim",
      name: "Nominatim (OpenStreetMap)",
      kinds: ["geocoding"],
      requires: [],
      configured: true,
      storable: true,
      licensing: "ODbL; usage policy: max 1 request/second, valid User-Agent, no heavy use.",
      cost: "Free (public instance) or self-hosted.",
      docsUrl: "https://operations.osmfoundation.org/policies/nominatim/",
    };
  }

  private async get(path: string) {
    const res = await providerFetch(`${this.base}${path}`, {
      provider: "nominatim",
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US" },
      timeoutMs: 10_000,
      rate: { key: "nominatim", perSec: 1 },
    });
    return res.json();
  }

  async geocode(query: string): Promise<GeocodeResult[]> {
    return cache.wrap(`nom:${query.toLowerCase()}`, async () => {
      const params = new URLSearchParams({ q: query, format: "jsonv2", countrycodes: "us", limit: "5" });
      const json = (await this.get(`/search?${params}`)) as { display_name: string; lat: string; lon: string; type?: string }[];
      return json.map((r) => ({
        label: r.display_name,
        point: { lat: Number(r.lat), lng: Number(r.lon) },
        source: "osm" as const,
        precision: r.type === "house" ? ("rooftop" as const) : ("approximate" as const),
      }));
    });
  }

  async reverse(point: LatLng): Promise<GeocodeResult | undefined> {
    const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: "jsonv2", zoom: "17" });
    const r = (await this.get(`/reverse?${params}`)) as { display_name?: string; address?: Record<string, string> };
    if (!r.display_name) return undefined;
    const a = r.address ?? {};
    const short = [[a.house_number, a.road].filter(Boolean).join(" "), a.city ?? a.town ?? a.village].filter(Boolean).join(", ");
    return { label: short || r.display_name, point, source: "osm", precision: "approximate" };
  }
}

/** Google Geocoding — optional, only if a key is configured. */
export class GoogleGeocoder implements GeocodingProvider {
  private key = process.env.GOOGLE_PLACES_API_KEY;

  info(): ProviderInfo {
    return {
      id: "google_geocoding",
      name: "Google Geocoding API",
      kinds: ["geocoding"],
      requires: ["GOOGLE_PLACES_API_KEY"],
      configured: !!this.key,
      storable: false,
      licensing: "Google Maps Platform ToS.",
      cost: "Pay-as-you-go (Essentials SKU, ~10k free/month).",
      docsUrl: "https://developers.google.com/maps/documentation/geocoding",
    };
  }

  async geocode(query: string): Promise<GeocodeResult[]> {
    if (!this.key) return [];
    const params = new URLSearchParams({ address: query, key: this.key, components: "country:US" });
    const res = await providerFetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { provider: "google_geocoding" });
    const json = (await res.json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number }; location_type: string } }[] };
    return (json.results ?? []).map((r) => ({
      label: r.formatted_address,
      point: r.geometry.location,
      source: "google_places" as const,
      precision: r.geometry.location_type === "ROOFTOP" ? ("rooftop" as const) : ("approximate" as const),
    }));
  }
}

/** Try providers in order; first non-empty answer wins. Errors fall through to the next. */
export async function geocodeWithFallback(query: string, providers: GeocodingProvider[]): Promise<{ results: GeocodeResult[]; errors: string[] }> {
  const errors: string[] = [];
  for (const p of providers) {
    if (!p.info().configured) continue;
    try {
      const results = await p.geocode(query);
      if (results.length) return { results, errors };
    } catch (err) {
      errors.push(`${p.info().id}: ${(err as Error).message}`);
    }
  }
  return { results: [], errors };
}
