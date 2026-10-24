import { CHAINS } from "./catalog/chains";
import { haversineKm } from "./geo";
import type { DiscoveredPlace } from "./providers/types";
import type { Chain, LatLng, RestaurantKind } from "./types";

/**
 * Entity resolution for places coming from several sources.
 *
 * - Chain branches: one record per physical location, linked to the chain.
 * - Same place from two sources (OSM + Google, or a duplicate OSM node/way): merged.
 * - Virtual brands / ghost kitchens: share an address with a host kitchen but
 *   are a different brand — linked to the host, never merged into it.
 */

const STOPWORDS = new Set(["the", "restaurant", "restaurants", "inc", "llc", "co", "company", "grill", "kitchen"]);

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/#\s*\d+/g, " ")
    .replace(/\bstore\s*\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

function tokens(s: string) {
  return new Set(normalizeName(s).split(" ").filter(Boolean));
}

/** Token Jaccard + containment, 0..1. Robust to "Taco Bell Cantina" vs "Taco Bell". */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.9);
}

const chainKeys = CHAINS.map((c) => ({
  chain: c,
  keys: [c.name, ...c.aliases].map(normalizeName).filter(Boolean),
}));

/** Match a discovered place to a known chain: brand:wikidata first, then names. */
export function matchChain(place: Pick<DiscoveredPlace, "name" | "brand" | "brandWikidata">, chains: Chain[] = CHAINS): Chain | undefined {
  if (place.brandWikidata) {
    const byQid = chains.find((c) => c.wikidata === place.brandWikidata);
    if (byQid) return byQid;
  }
  const candidates = chains === CHAINS ? chainKeys : chains.map((c) => ({ chain: c, keys: [c.name, ...c.aliases].map(normalizeName) }));
  for (const label of [place.brand, place.name]) {
    if (!label) continue;
    const n = normalizeName(label);
    if (!n) continue;
    for (const { chain, keys } of candidates) {
      if (keys.some((k) => n === k || prefixMatch(n, k))) return chain;
    }
  }
  return undefined;
}

/**
 * "Taco Bell Cantina" → Taco Bell, but "Sonic Boom Bar" ≠ Sonic. Single-word
 * chain names need an exact match or a store-number/format suffix.
 */
function prefixMatch(name: string, key: string): boolean {
  if (!name.startsWith(`${key} `)) return false;
  const rest = name.slice(key.length + 1).split(" ");
  if (rest.every((t) => /^\d+$/.test(t)) || /^(drive in|express|cantina|to go|grill and chill)$/.test(rest.join(" "))) return true;
  return key.includes(" ") && rest.length <= 2;
}

/** Known delivery-only virtual brands. Extend via admin by setting `kind`. */
const VIRTUAL_BRANDS = ["mrbeast burger", "its just wings", "pardon my cheesesteak", "wing boss"];

export function detectKind(place: Pick<DiscoveredPlace, "name" | "amenity">): RestaurantKind {
  const n = normalizeName(place.name);
  if (VIRTUAL_BRANDS.some((v) => n === v || n.startsWith(`${v} `))) return "virtual_brand";
  if (/\bghost kitchen\b|\bcloud kitchen\b/.test(n)) return "ghost_kitchen";
  return "standard";
}

export interface ResolvableRecord {
  id: string;
  name: string;
  chainId?: string;
  location: LatLng;
  phone?: string;
  kind: RestaurantKind;
}

export type Resolution =
  | { type: "same"; id: string; reason: string }
  | { type: "virtual_of"; hostId: string; reason: string }
  | { type: "new" };

const digits = (p?: string) => (p ?? "").replace(/\D/g, "").slice(-10);

/**
 * Decide whether an incoming place is an existing record, a virtual brand hosted
 * by an existing record, or a new location.
 */
export function resolvePlace(
  incoming: { name: string; chainId?: string; location: LatLng; phone?: string; kind: RestaurantKind },
  existing: ResolvableRecord[],
): Resolution {
  let best: { rec: ResolvableRecord; score: number; reason: string } | undefined;

  for (const rec of existing) {
    const d = haversineKm(incoming.location, rec.location) * 1000; // metres
    if (d > 250) continue;
    const sim = nameSimilarity(incoming.name, rec.name);
    let score = 0;
    let reason = "";

    if (incoming.chainId && rec.chainId) {
      if (incoming.chainId === rec.chainId && d <= 80) {
        score = 1 - d / 400;
        reason = `same chain within ${Math.round(d)} m`;
      }
    } else if (sim >= 0.85 && d <= 60) {
      score = sim - d / 600;
      reason = `name match ${(sim * 100).toFixed(0)}% within ${Math.round(d)} m`;
    } else if (digits(incoming.phone) && digits(incoming.phone) === digits(rec.phone) && d <= 150 && sim >= 0.5) {
      score = 0.8;
      reason = "same phone number nearby";
    }

    if (score > 0 && (!best || score > best.score)) best = { rec, score, reason };
  }

  if (best) return { type: "same", id: best.rec.id, reason: best.reason };

  if (incoming.kind === "virtual_brand" || incoming.kind === "ghost_kitchen") {
    const host = existing
      .filter((r) => r.kind === "standard")
      .map((r) => ({ r, d: haversineKm(incoming.location, r.location) * 1000 }))
      .filter(({ d }) => d <= 25)
      .sort((a, b) => a.d - b.d)[0];
    if (host) return { type: "virtual_of", hostId: host.r.id, reason: `operates from ${host.r.name} (${Math.round(host.d)} m)` };
  }

  return { type: "new" };
}
