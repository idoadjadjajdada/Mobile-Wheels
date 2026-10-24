import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CHAINS } from "../catalog/chains";
import { MARKETS } from "../catalog/markets";
import { CATALOG_ITEMS } from "../catalog/menu";
import { haversineKm } from "../geo";
import type { DeliveryListing, MenuItem, Promotion } from "../types";
import type { DataChange, Group, RefreshRun, Repository, RestaurantQuery, StoredRestaurant, UserReport } from "./repository";

/**
 * Development store: a JSON file (default .data/crave-local.json). Same
 * interface as the Supabase repository so everything above it is identical.
 * Not for production — serverless filesystems are ephemeral. The admin
 * dashboard shows a warning banner while this mode is active.
 */

interface LocalState {
  restaurants: StoredRestaurant[];
  /** Admin-created items and overrides of catalog items (same id). */
  menuItems: MenuItem[];
  deletedMenuItems: string[];
  listings: DeliveryListing[];
  promotions: Promotion[];
  runs: RefreshRun[];
  changes: DataChange[];
  reports: UserReport[];
  groups: Group[];
}

const empty = (): LocalState => ({
  restaurants: [],
  menuItems: [],
  deletedMenuItems: [],
  listings: [],
  promotions: [],
  runs: [],
  changes: [],
  reports: [],
  groups: [],
});

const g = globalThis as unknown as { __craveLocal?: { file: string; state: LocalState } };

function load(): LocalState {
  const file = process.env.CRAVE_LOCAL_DB || path.join(process.cwd(), ".data", "crave-local.json");
  if (g.__craveLocal?.file === file) return g.__craveLocal.state;
  let state = empty();
  try {
    state = { ...empty(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    // first run
  }
  g.__craveLocal = { file, state };
  return state;
}

function save() {
  const cur = g.__craveLocal;
  if (!cur) return;
  fs.mkdirSync(path.dirname(cur.file), { recursive: true });
  const tmp = `${cur.file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cur.state));
  fs.renameSync(tmp, cur.file);
}

function upsertBy<T>(arr: T[], item: T, key: (t: T) => string) {
  const i = arr.findIndex((x) => key(x) === key(item));
  if (i >= 0) arr[i] = item;
  else arr.push(item);
  return item;
}

function allMenuItems(s: LocalState): MenuItem[] {
  const overrides = new Map(s.menuItems.map((m) => [m.id, m]));
  const deleted = new Set(s.deletedMenuItems);
  const base = CATALOG_ITEMS.filter((m) => !overrides.has(m.id) && !deleted.has(m.id));
  return [...base, ...s.menuItems.filter((m) => !deleted.has(m.id))];
}

function groupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const;

  async listMarkets() {
    return MARKETS;
  }

  async listChains() {
    return CHAINS;
  }

  async restaurantsNear(point: { lat: number; lng: number }, radiusKm: number) {
    return load()
      .restaurants.filter((r) => r.status === "active" && !r.duplicateOf)
      .map((restaurant) => ({ restaurant, distanceKm: haversineKm(point, restaurant.location) }))
      .filter((x) => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getRestaurant(id: string) {
    return load().restaurants.find((r) => r.id === id) ?? null;
  }

  async queryRestaurants(q: RestaurantQuery) {
    const needle = q.q?.toLowerCase().trim();
    let rows = load().restaurants.filter(
      (r) =>
        (q.includeHidden || r.status === "active") &&
        (!q.marketId || r.marketId === q.marketId) &&
        (!q.chainId || r.chainId === q.chainId) &&
        (!q.refreshStatus || r.refreshStatus === q.refreshStatus) &&
        (!needle || r.name.toLowerCase().includes(needle) || (r.address.line1 ?? "").toLowerCase().includes(needle)),
    );
    rows = rows.sort((a, b) => a.name.localeCompare(b.name));
    const total = rows.length;
    const offset = q.offset ?? 0;
    return { rows: rows.slice(offset, offset + (q.limit ?? 50)), total };
  }

  async upsertRestaurant(r: StoredRestaurant) {
    const s = load();
    const row = { ...r, id: r.id || randomUUID(), updatedAt: new Date().toISOString() };
    upsertBy(s.restaurants, row, (x) => x.id);
    save();
    return row;
  }

  async resolvableIn(marketId: string) {
    return load()
      .restaurants.filter((r) => r.marketId === marketId && !r.duplicateOf)
      .map((r) => ({ id: r.id, name: r.name, chainId: r.chainId, location: r.location, phone: r.phone, kind: r.kind, externalIds: r.externalIds, contentHash: r.contentHash }));
  }

  async menuFor(restaurants: { id: string; chainId?: string }[]) {
    const items = allMenuItems(load());
    const out = new Map<string, MenuItem[]>();
    for (const r of restaurants) {
      const local = items.filter((m) => m.restaurantId === r.id);
      // A location-specific item with the same name overrides the chain item (e.g. a verified local price).
      const localNames = new Set(local.map((m) => m.name.toLowerCase()));
      const chain = r.chainId ? items.filter((m) => m.chainId === r.chainId && !m.restaurantId && !localNames.has(m.name.toLowerCase())) : [];
      out.set(r.id, [...local, ...chain].filter((m) => m.available));
    }
    return out;
  }

  async getMenuItem(id: string) {
    return allMenuItems(load()).find((m) => m.id === id) ?? null;
  }

  async upsertMenuItem(item: MenuItem) {
    const s = load();
    const row = { ...item, id: item.id || randomUUID() };
    s.deletedMenuItems = s.deletedMenuItems.filter((d) => d !== row.id);
    upsertBy(s.menuItems, row, (x) => x.id);
    save();
    return row;
  }

  async deleteMenuItem(id: string) {
    const s = load();
    s.menuItems = s.menuItems.filter((m) => m.id !== id);
    if (CATALOG_ITEMS.some((m) => m.id === id)) s.deletedMenuItems.push(id);
    save();
  }

  async listingsFor(ids: string[]) {
    const out = new Map<string, DeliveryListing[]>();
    const set = new Set(ids);
    for (const l of load().listings) if (set.has(l.restaurantId)) out.set(l.restaurantId, [...(out.get(l.restaurantId) ?? []), l]);
    return out;
  }

  async upsertListing(l: DeliveryListing) {
    const s = load();
    const existing = s.listings.find((x) => x.restaurantId === l.restaurantId && x.platform === l.platform);
    const row = { ...l, id: existing?.id ?? l.id ?? randomUUID() };
    upsertBy(s.listings, row, (x) => x.id);
    save();
    return row;
  }

  async deleteListing(id: string) {
    const s = load();
    s.listings = s.listings.filter((l) => l.id !== id);
    save();
  }

  async promotionsFor(restaurants: { id: string; chainId?: string }[]) {
    const today = new Date().toISOString().slice(0, 10);
    const promos = load().promotions.filter((p) => !p.validUntil || p.validUntil >= today);
    return new Map(restaurants.map((r) => [r.id, promos.filter((p) => p.restaurantId === r.id || (p.chainId && p.chainId === r.chainId))]));
  }

  async upsertPromotion(p: Promotion) {
    const s = load();
    const row = { ...p, id: p.id || randomUUID() };
    upsertBy(s.promotions, row, (x) => x.id);
    save();
    return row;
  }

  async startRun(run: Omit<RefreshRun, "id" | "startedAt" | "status" | "stats">) {
    const s = load();
    const row: RefreshRun = { ...run, id: randomUUID(), startedAt: new Date().toISOString(), status: "running", stats: {} };
    s.runs.unshift(row);
    s.runs = s.runs.slice(0, 200);
    save();
    return row;
  }

  async finishRun(id: string, patch: Pick<RefreshRun, "status" | "stats"> & { error?: string }) {
    const s = load();
    const run = s.runs.find((r) => r.id === id);
    if (run) Object.assign(run, patch, { finishedAt: new Date().toISOString() });
    save();
  }

  async listRuns(limit = 20) {
    return load().runs.slice(0, limit);
  }

  async recordChanges(changes: DataChange[]) {
    if (!changes.length) return;
    const s = load();
    let id = s.changes.reduce((m, c) => Math.max(m, c.id ?? 0), 0);
    for (const c of changes) s.changes.unshift({ ...c, id: ++id });
    s.changes = s.changes.slice(0, 5000);
    save();
  }

  async listChanges(opts: { unreviewedOnly?: boolean; limit?: number } = {}) {
    return load()
      .changes.filter((c) => !opts.unreviewedOnly || !c.reviewedAt)
      .slice(0, opts.limit ?? 100);
  }

  async markChangesReviewed(ids: number[]) {
    const s = load();
    const now = new Date().toISOString();
    for (const c of s.changes) if (c.id != null && ids.includes(c.id)) c.reviewedAt = now;
    save();
  }

  async addReport(r: Omit<UserReport, "id" | "createdAt" | "status">) {
    const s = load();
    s.reports.unshift({ ...r, id: randomUUID(), createdAt: new Date().toISOString(), status: "open" });
    save();
  }

  async listReports(status?: UserReport["status"]) {
    return load().reports.filter((r) => !status || r.status === status);
  }

  async setReportStatus(id: string, status: UserReport["status"]) {
    const s = load();
    const r = s.reports.find((x) => x.id === id);
    if (r) r.status = status;
    save();
  }

  async createGroup(input: { name: string; center?: { lat: number; lng: number }; memberId: string; displayName: string }) {
    const s = load();
    const group: Group = {
      id: randomUUID(),
      code: groupCode(),
      name: input.name,
      center: input.center,
      expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      members: [{ memberId: input.memberId, displayName: input.displayName }],
      swipes: [],
    };
    s.groups = s.groups.filter((x) => Date.parse(x.expiresAt) > Date.now());
    s.groups.push(group);
    save();
    return group;
  }

  async getGroup(code: string) {
    const grp = load().groups.find((x) => x.code === code.toUpperCase());
    return grp && Date.parse(grp.expiresAt) > Date.now() ? grp : null;
  }

  async joinGroup(code: string, memberId: string, displayName: string) {
    const grp = await this.getGroup(code);
    if (!grp) return null;
    if (!grp.members.some((m) => m.memberId === memberId)) {
      if (grp.members.length >= 12) return null;
      grp.members.push({ memberId, displayName });
      save();
    }
    return grp;
  }

  async groupSwipe(code: string, sw: Group["swipes"][number]) {
    const grp = await this.getGroup(code);
    if (!grp || !grp.members.some((m) => m.memberId === sw.memberId)) throw new Error("not a member");
    grp.swipes = grp.swipes.filter((x) => !(x.memberId === sw.memberId && x.offeringKey === sw.offeringKey));
    grp.swipes.push(sw);
    save();
  }
}
