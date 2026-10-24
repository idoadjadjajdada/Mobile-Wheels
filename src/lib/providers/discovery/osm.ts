import type { TriState } from "../../types";
import { ProviderError, providerFetch, USER_AGENT } from "../http";
import type { DiscoveredPlace, DiscoveryArea, DiscoveryProvider, ProviderInfo } from "../types";

/**
 * OpenStreetMap via the Overpass API. Keyless, ODbL-licensed, storable with
 * attribution. This is CRAVE's automated discovery backbone.
 *
 * Fair use: public instances ask for modest volumes; we rate-limit to one
 * request every 2 s and split large areas into tiles. Point OVERPASS_URL at a
 * self-hosted instance for heavier use.
 */

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";
const FOOD_AMENITIES = ["fast_food", "restaurant", "food_court", "cafe", "ice_cream"];

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(area: DiscoveryArea, brandsOnly = false): string {
  const [s, w, n, e] = area.bbox;
  const bbox = `${s},${w},${n},${e}`;
  const brand = brandsOnly ? `["brand"]` : "";
  const selectors = FOOD_AMENITIES.map((a) => `nwr["amenity"="${a}"]${brand}(${bbox});`).join("\n  ");
  return `[out:json][timeout:90];\n(\n  ${selectors}\n);\nout center tags;`;
}

function tri(v?: string): TriState {
  if (!v) return "unknown";
  if (["yes", "only"].includes(v)) return "yes";
  if (v === "no") return "no";
  return "unknown";
}

export function parseOverpass(json: { elements?: OverpassElement[] }): DiscoveredPlace[] {
  const out: DiscoveredPlace[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = t.name ?? t.brand;
    if (lat == null || lon == null || !name) continue;
    // Skip places mapped as permanently closed / disused.
    if (t["disused:amenity"] || t["was:amenity"] || t.opening_hours === "closed") continue;
    out.push({
      source: "osm",
      sourceRef: `${el.type}/${el.id}`,
      name,
      brand: t.brand,
      brandWikidata: t["brand:wikidata"],
      location: { lat, lng: lon },
      address: {
        line1: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || undefined,
        city: t["addr:city"],
        state: t["addr:state"],
        postalCode: t["addr:postcode"],
      },
      phone: t.phone ?? t["contact:phone"],
      website: t.website ?? t["contact:website"],
      cuisine: (t.cuisine ?? "").split(";").map((c) => c.trim().replace(/_/g, " ")).filter(Boolean),
      amenity: t.amenity,
      openingHoursRaw: t.opening_hours,
      deliveryTag: tri(t.delivery),
      takeawayTag: tri(t.takeaway),
      raw: el,
    });
  }
  return out;
}

/** Split a bbox into tiles no larger than `maxDeg` on a side. */
export function tileBbox(bbox: [number, number, number, number], maxDeg = 0.15): [number, number, number, number][] {
  const [s, w, n, e] = bbox;
  const rows = Math.max(1, Math.ceil((n - s) / maxDeg));
  const cols = Math.max(1, Math.ceil((e - w) / maxDeg));
  const tiles: [number, number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push([
        s + ((n - s) * r) / rows,
        w + ((e - w) * c) / cols,
        s + ((n - s) * (r + 1)) / rows,
        w + ((e - w) * (c + 1)) / cols,
      ]);
    }
  }
  return tiles;
}

export class OsmOverpassProvider implements DiscoveryProvider {
  constructor(private endpoint = process.env.OVERPASS_URL || DEFAULT_ENDPOINT) {}

  info(): ProviderInfo {
    return {
      id: "osm",
      name: "OpenStreetMap (Overpass API)",
      kinds: ["discovery"],
      requires: [],
      configured: true,
      storable: true,
      licensing: "ODbL — store with attribution “© OpenStreetMap contributors”.",
      cost: "Free (fair use on public instances; self-host for scale).",
      docsUrl: "https://wiki.openstreetmap.org/wiki/Overpass_API",
    };
  }

  async discover(area: DiscoveryArea, opts: { brandsOnly?: boolean; signal?: AbortSignal } = {}): Promise<DiscoveredPlace[]> {
    const seen = new Set<string>();
    const places: DiscoveredPlace[] = [];
    for (const tile of tileBbox(area.bbox)) {
      if (opts.signal?.aborted) throw new ProviderError("aborted", "osm");
      const res = await providerFetch(this.endpoint, {
        provider: "osm",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: new URLSearchParams({ data: buildOverpassQuery({ bbox: tile }, opts.brandsOnly) }).toString(),
        timeoutMs: 120_000,
        retries: 3,
        rate: { key: "osm-overpass", perSec: 0.5 },
      });
      const json = (await res.json()) as { elements?: OverpassElement[] };
      for (const p of parseOverpass(json)) {
        if (seen.has(p.sourceRef)) continue;
        seen.add(p.sourceRef);
        places.push(p);
      }
    }
    return places;
  }
}
