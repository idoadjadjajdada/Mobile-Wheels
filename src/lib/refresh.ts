import { createHash } from "node:crypto";
import { CHAINS } from "./catalog/chains";
import type { DataChange, Repository, StoredRestaurant } from "./db/repository";
import { detectKind, matchChain, resolvePlace } from "./dedupe";
import { normalizeOsmHours, zonedParts } from "./hours";
import type { DiscoveredPlace, DiscoveryProvider } from "./providers/types";
import type { HoursSet, Market } from "./types";

/**
 * Scheduled refresh for a market.
 *
 *  discover (rate-limited adapter) → match chain → resolve duplicates →
 *  hash-based change detection → per-field diff (admin-locked fields are never
 *  overwritten) → change log → mark vanished places stale (never auto-delete).
 *
 * National/regional chains are processed first, matching the rollout priority.
 */

export interface RefreshStats {
  discovered: number;
  chainMatched: number;
  created: number;
  updated: number;
  unchanged: number;
  merged: number;
  virtualLinked: number;
  skippedLocked: number;
  markedStale: number;
  wikidataSuggestions: number;
  [k: string]: number;
}

const TRACKED_FIELDS = ["name", "chainId", "kind", "address", "phone", "website", "cuisine", "hours", "pickup"] as const;

export function placeHash(p: DiscoveredPlace): string {
  const stable = {
    name: p.name,
    brand: p.brand,
    wd: p.brandWikidata,
    lat: p.location.lat.toFixed(5),
    lng: p.location.lng.toFixed(5),
    addr: p.address,
    phone: p.phone,
    web: p.website,
    cuisine: p.cuisine,
    oh: p.openingHoursRaw,
    del: p.deliveryTag,
    take: p.takeawayTag,
  };
  return createHash("sha1").update(JSON.stringify(stable)).digest("hex");
}

async function hoursFromPlace(p: DiscoveredPlace, market: Market, now: Date): Promise<HoursSet | undefined> {
  if (!p.openingHoursRaw) return undefined;
  const local = zonedParts(now, market.timezone);
  const norm = await normalizeOsmHours(p.openingHoursRaw, {
    lat: p.location.lat,
    lng: p.location.lng,
    today: { year: local.year, month: local.month, day: local.day },
    specialDays: 45,
  });
  if (!norm) return undefined;
  return {
    regular: norm.regular,
    special: norm.special,
    raw: p.openingHoursRaw,
    provenance: { source: p.source, sourceRef: p.sourceRef, verification: "reported", fetchedAt: now.toISOString(), attribution: "© OpenStreetMap contributors" },
  };
}

function draftFromPlace(p: DiscoveredPlace, market: Market, now: Date, hours: HoursSet | undefined): StoredRestaurant {
  const chain = matchChain(p);
  return {
    id: "",
    marketId: market.id,
    chainId: chain?.id,
    name: p.name,
    kind: detectKind(p),
    address: p.address,
    location: p.location,
    phone: p.phone,
    website: p.website,
    cuisine: p.cuisine,
    priceLevel: chain?.priceLevel,
    hours: hours ? { general: hours } : {},
    pickup: p.takeawayTag,
    externalIds: p.source === "osm" ? { osm: p.sourceRef } : p.source === "google_places" ? { google: p.sourceRef } : { foursquare: p.sourceRef },
    provenance: { source: p.source, sourceRef: p.sourceRef, verification: "reported", fetchedAt: now.toISOString(), attribution: p.source === "osm" ? "© OpenStreetMap contributors" : undefined },
    status: "active",
    isDemo: false,
    updatedAt: now.toISOString(),
    lockedFields: [],
    refreshStatus: "fresh",
    lastRefreshedAt: now.toISOString(),
  };
}

/** "unknown", empty strings/arrays/objects carry no information and never overwrite data. */
const isEmpty = (v: unknown) =>
  v == null || v === "" || v === "unknown" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.values(v as object).some((x) => x != null && x !== ""));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Compare hours by schedule only, not by fetch timestamp. */
const hoursKey = (h?: StoredRestaurant["hours"]) => (h?.general ? { r: h.general.regular, s: h.general.special, raw: h.general.raw } : null);

export async function refreshMarket(
  repo: Repository,
  market: Market,
  provider: DiscoveryProvider,
  opts: { trigger?: "schedule" | "manual" | "cli"; now?: Date; brandsOnly?: boolean; limit?: number; markStale?: boolean } = {},
): Promise<{ runId: string; stats: RefreshStats; status: "succeeded" | "failed" | "partial"; error?: string }> {
  const now = opts.now ?? new Date();
  const info = provider.info();
  const run = await repo.startRun({ marketId: market.id, source: info.id as DataChange["source"], trigger: opts.trigger ?? "manual" });
  const stats: RefreshStats = {
    discovered: 0,
    chainMatched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    merged: 0,
    virtualLinked: 0,
    skippedLocked: 0,
    markedStale: 0,
    wikidataSuggestions: 0,
  };
  const changes: DataChange[] = [];
  const change = (c: Omit<DataChange, "detectedAt" | "runId" | "source">) =>
    changes.push({ ...c, runId: run.id, source: info.id as DataChange["source"], detectedAt: now.toISOString() });

  try {
    let places = await provider.discover({ bbox: market.bbox }, { brandsOnly: opts.brandsOnly });
    stats.discovered = places.length;
    const priority = (p: DiscoveredPlace) => matchChain(p)?.priority ?? 1000;
    places = places.sort((a, b) => priority(a) - priority(b));
    if (opts.limit) places = places.slice(0, opts.limit);

    const existing = await repo.resolvableIn(market.id);
    const byExternal = new Map(existing.filter((e) => e.externalIds.osm).map((e) => [e.externalIds.osm!, e]));
    const seenIds = new Set<string>();
    const suggested = new Set<string>();

    for (const p of places) {
      const chain = matchChain(p);
      if (chain) stats.chainMatched++;
      if (chain && !chain.wikidata && p.brandWikidata && !suggested.has(chain.id)) {
        suggested.add(chain.id);
        stats.wikidataSuggestions++;
        change({ entityType: "chain", entityId: chain.id, changeType: "updated", field: "wikidata", newValue: p.brandWikidata });
      }

      const hash = placeHash(p);
      const known = byExternal.get(p.sourceRef);
      if (known && known.contentHash === hash) {
        stats.unchanged++;
        seenIds.add(known.id);
        continue;
      }

      const hours = await hoursFromPlace(p, market, now);
      const draft = { ...draftFromPlace(p, market, now, hours), contentHash: hash };
      const resolution = known
        ? ({ type: "same", id: known.id, reason: "same source id" } as const)
        : resolvePlace({ name: draft.name, chainId: draft.chainId, location: draft.location, phone: draft.phone, kind: draft.kind }, existing);

      if (resolution.type === "same") {
        const current = await repo.getRestaurant(resolution.id);
        if (!current) continue;
        seenIds.add(current.id);
        if (!known) stats.merged++;
        const next: StoredRestaurant = { ...current };
        let touched = false;
        // A different element for the same place (e.g. OSM node + building way) only fills gaps.
        const fillOnly = !known;
        for (const field of TRACKED_FIELDS) {
          const a = field === "hours" ? hoursKey(current.hours) : current[field];
          const b = field === "hours" ? hoursKey(draft.hours) : draft[field];
          if (same(a, b) || isEmpty(b)) continue;
          if (fillOnly && !isEmpty(a)) continue;
          if (current.lockedFields.includes(field)) {
            stats.skippedLocked++;
            change({ entityType: "restaurant", entityId: current.id, changeType: "skipped_locked", field, oldValue: a, newValue: b });
            continue;
          }
          (next as unknown as Record<string, unknown>)[field] = field === "hours" ? { ...current.hours, general: draft.hours.general } : draft[field];
          change({ entityType: "restaurant", entityId: current.id, changeType: "updated", field, oldValue: a, newValue: b });
          touched = true;
        }
        if (fillOnly) {
          if (touched) {
            await repo.upsertRestaurant(next);
            stats.updated++;
          } else stats.unchanged++;
          continue;
        }
        next.externalIds = { ...draft.externalIds, ...current.externalIds };
        next.contentHash = hash;
        next.refreshStatus = current.refreshStatus === "manual_only" ? "manual_only" : "fresh";
        next.lastRefreshedAt = now.toISOString();
        next.provenance = current.provenance.source === "manual" ? current.provenance : { ...current.provenance, fetchedAt: now.toISOString() };
        await repo.upsertRestaurant(next);
        if (touched) stats.updated++;
        else stats.unchanged++;
        await syncDirectListing(repo, next, p, now);
        continue;
      }

      if (resolution.type === "virtual_of") {
        draft.hostRestaurantId = resolution.hostId;
        stats.virtualLinked++;
      }
      const saved = await repo.upsertRestaurant(draft);
      seenIds.add(saved.id);
      existing.push({ id: saved.id, name: saved.name, chainId: saved.chainId, location: saved.location, phone: saved.phone, kind: saved.kind, externalIds: saved.externalIds, contentHash: hash });
      if (saved.externalIds.osm) byExternal.set(saved.externalIds.osm, existing[existing.length - 1]);
      stats.created++;
      change({ entityType: "restaurant", entityId: saved.id, changeType: "created", newValue: { name: saved.name, chainId: saved.chainId } });
      await syncDirectListing(repo, saved, p, now);
    }

    // Vanished from the source: flag for review, never delete automatically.
    if (opts.markStale !== false && !opts.limit && !opts.brandsOnly) {
      for (const e of existing) {
        if (seenIds.has(e.id) || !e.externalIds.osm || info.id !== "osm") continue;
        const r = await repo.getRestaurant(e.id);
        if (!r || r.refreshStatus === "stale" || r.refreshStatus === "manual_only") continue;
        await repo.upsertRestaurant({ ...r, refreshStatus: "stale" });
        stats.markedStale++;
        change({ entityType: "restaurant", entityId: r.id, changeType: "removed", field: "source_presence", oldValue: r.externalIds.osm });
      }
    }

    await repo.recordChanges(changes);
    await repo.finishRun(run.id, { status: "succeeded", stats });
    return { runId: run.id, stats, status: "succeeded" };
  } catch (err) {
    await repo.recordChanges(changes).catch(() => undefined);
    const status = stats.created + stats.updated > 0 ? "partial" : "failed";
    await repo.finishRun(run.id, { status, stats, error: (err as Error).message });
    return { runId: run.id, stats, status, error: (err as Error).message };
  }
}

/** OSM delivery=* describes the restaurant's own delivery. Never overwrite a manual listing. */
async function syncDirectListing(repo: Repository, r: StoredRestaurant, p: DiscoveredPlace, now: Date) {
  if (p.deliveryTag === "unknown") return;
  const current = (await repo.listingsFor([r.id])).get(r.id)?.find((l) => l.platform === "direct");
  if (current && current.provenance.source === "manual") return;
  if (current && current.offersDelivery === p.deliveryTag) return;
  await repo.upsertListing({
    id: current?.id ?? "",
    restaurantId: r.id,
    platform: "direct",
    listingStatus: "unknown",
    offersDelivery: p.deliveryTag,
    offersPickup: p.takeawayTag,
    provenance: { source: p.source, sourceRef: p.sourceRef, verification: "reported", fetchedAt: now.toISOString() },
  });
}

export function chainCoverage(restaurants: { chainId?: string }[]) {
  return CHAINS.map((c) => ({ chain: c, count: restaurants.filter((r) => r.chainId === c.id).length }));
}
