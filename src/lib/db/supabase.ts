import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Chain, DeliveryListing, Market, MenuItem, Promotion, Restaurant, SourceKind } from "../types";
import type { DataChange, Group, RefreshRun, Repository, RestaurantQuery, StoredRestaurant, UserReport } from "./repository";

/**
 * Server-only Supabase repository (imported via db/index.ts, which is "server-only"). Uses the service role key, so every caller
 * must have already authorized the request (public read routes, or
 * requireAdmin() for writes). Never import this from client components.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data as T;
}

const num = (v: unknown) => (v == null ? undefined : Number(v));
const str = (v: unknown) => (v == null ? undefined : String(v));

// ---------- mapping ----------

function toMarket(r: Row): Market {
  return {
    id: r.id as string,
    name: r.name as string,
    timezone: r.timezone as string,
    bbox: [Number(r.bbox_south), Number(r.bbox_west), Number(r.bbox_north), Number(r.bbox_east)],
    center: { lat: Number(r.center_lat), lng: Number(r.center_lng) },
    taxRate: Number(r.tax_rate),
    active: !!r.active,
  };
}

function toChain(r: Row): Chain {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    tier: r.tier as Chain["tier"],
    priority: Number(r.priority),
    wikidata: str(r.wikidata),
    aliases: (r.aliases as string[]) ?? [],
    website: str(r.website),
    directOrderUrl: str(r.direct_order_url),
    categories: (r.categories as string[]) ?? [],
    priceLevel: num(r.price_level) as Chain["priceLevel"],
  };
}

function toRestaurant(r: Row): StoredRestaurant {
  return {
    id: r.id as string,
    marketId: r.market_id as string,
    chainId: str(r.chain_id),
    name: r.name as string,
    kind: r.kind as Restaurant["kind"],
    hostRestaurantId: str(r.host_restaurant_id),
    address: { line1: str(r.address_line1), city: str(r.city), state: str(r.state), postalCode: str(r.postal_code) },
    location: { lat: Number(r.lat), lng: Number(r.lng) },
    phone: str(r.phone),
    website: str(r.website),
    cuisine: (r.cuisine as string[]) ?? [],
    priceLevel: num(r.price_level) as Restaurant["priceLevel"],
    hours: (r.hours as Restaurant["hours"]) ?? {},
    rating:
      r.rating_value != null
        ? { value: Number(r.rating_value), count: num(r.rating_count), source: r.rating_source as SourceKind, fetchedAt: String(r.rating_fetched_at) }
        : undefined,
    pickup: r.pickup as Restaurant["pickup"],
    externalIds: { osm: str(r.osm_id), google: str(r.google_place_id), foursquare: str(r.foursquare_id) },
    provenance: {
      source: r.source as SourceKind,
      sourceRef: str(r.source_ref),
      verification: r.verification as Restaurant["provenance"]["verification"],
      verifiedAt: str(r.verified_at),
      fetchedAt: str(r.fetched_at),
    },
    status: r.status as Restaurant["status"],
    isDemo: false,
    updatedAt: String(r.updated_at),
    lockedFields: (r.locked_fields as string[]) ?? [],
    contentHash: str(r.content_hash),
    refreshStatus: r.refresh_status as StoredRestaurant["refreshStatus"],
    lastRefreshedAt: str(r.last_refreshed_at),
    duplicateOf: str(r.duplicate_of),
  };
}

function fromRestaurant(r: StoredRestaurant): Row {
  const row: Row = {
    market_id: r.marketId,
    chain_id: r.chainId ?? null,
    name: r.name,
    kind: r.kind,
    host_restaurant_id: r.hostRestaurantId ?? null,
    address_line1: r.address.line1 ?? null,
    city: r.address.city ?? null,
    state: r.address.state ?? null,
    postal_code: r.address.postalCode ?? null,
    lat: r.location.lat,
    lng: r.location.lng,
    phone: r.phone ?? null,
    website: r.website ?? null,
    cuisine: r.cuisine,
    price_level: r.priceLevel ?? null,
    hours: r.hours,
    pickup: r.pickup,
    // Only storable ratings are persisted (never Google's).
    rating_value: r.rating && r.rating.source !== "google_places" ? r.rating.value : null,
    rating_count: r.rating && r.rating.source !== "google_places" ? (r.rating.count ?? null) : null,
    rating_source: r.rating && r.rating.source !== "google_places" ? r.rating.source : null,
    rating_fetched_at: r.rating && r.rating.source !== "google_places" ? r.rating.fetchedAt : null,
    osm_id: r.externalIds.osm ?? null,
    google_place_id: r.externalIds.google ?? null,
    foursquare_id: r.externalIds.foursquare ?? null,
    source: r.provenance.source,
    source_ref: r.provenance.sourceRef ?? null,
    verification: r.provenance.verification,
    verified_at: r.provenance.verifiedAt ?? null,
    fetched_at: r.provenance.fetchedAt ?? null,
    locked_fields: r.lockedFields,
    content_hash: r.contentHash ?? null,
    refresh_status: r.refreshStatus,
    last_refreshed_at: r.lastRefreshedAt ?? null,
    status: r.status,
    duplicate_of: r.duplicateOf ?? null,
  };
  if (r.id && UUID_RE.test(r.id)) row.id = r.id;
  return row;
}

function toMenuItem(r: Row): MenuItem {
  const priceStatus = r.price_status as MenuItem["price"]["status"];
  return {
    id: (r.catalog_key as string) ?? (r.id as string),
    chainId: str(r.chain_id),
    restaurantId: str(r.restaurant_id),
    name: r.name as string,
    description: str(r.description),
    category: r.category as MenuItem["category"],
    ingredients: (r.ingredients as string[]) ?? [],
    isCombo: !!r.is_combo,
    price: {
      amount: num(r.price_amount),
      low: num(r.price_low),
      high: num(r.price_high),
      currency: "USD",
      status: priceStatus,
      source: r.source as SourceKind,
      channel: str(r.price_channel) as MenuItem["price"]["channel"],
      verifiedAt: str(r.price_verified_at),
    },
    comboPrice:
      r.combo_price_amount != null || r.combo_price_low != null
        ? {
            amount: num(r.combo_price_amount),
            low: num(r.combo_price_low),
            high: num(r.combo_price_high),
            currency: "USD",
            status: r.combo_price_status as MenuItem["price"]["status"],
            source: r.source as SourceKind,
          }
        : undefined,
    portion: { size: r.portion_size as MenuItem["portion"]["size"], note: str(r.portion_note) },
    nutrition: (r.nutrition as MenuItem["nutrition"]) ?? undefined,
    allergens: (r.allergens as MenuItem["allergens"]) ?? undefined,
    dietary: (r.dietary as string[]) ?? [],
    image: r.image_url ? { url: String(r.image_url), kind: (r.image_kind as "official") ?? "official", attribution: str(r.image_attribution) } : undefined,
    orderPath: str(r.order_path),
    available: r.available !== false,
    provenance: {
      source: r.source as SourceKind,
      sourceRef: str(r.source_ref),
      verification: r.verification as MenuItem["provenance"]["verification"],
      verifiedAt: str(r.verified_at),
    },
  };
}

export function fromMenuItem(m: MenuItem): Row {
  const row: Row = {
    chain_id: m.chainId ?? null,
    restaurant_id: m.restaurantId ?? null,
    name: m.name,
    description: m.description ?? null,
    category: m.category,
    ingredients: m.ingredients,
    is_combo: m.isCombo,
    price_amount: m.price.amount ?? null,
    price_low: m.price.low ?? null,
    price_high: m.price.high ?? null,
    price_status: m.price.status,
    price_channel: m.price.channel ?? null,
    price_verified_at: m.price.verifiedAt ?? null,
    combo_price_amount: m.comboPrice?.amount ?? null,
    combo_price_low: m.comboPrice?.low ?? null,
    combo_price_high: m.comboPrice?.high ?? null,
    combo_price_status: m.comboPrice?.status ?? "unknown",
    portion_size: m.portion.size,
    portion_note: m.portion.note ?? null,
    nutrition: m.nutrition ?? null,
    allergens: m.allergens ?? null,
    dietary: m.dietary,
    image_url: m.image?.url ?? null,
    image_kind: m.image?.kind ?? null,
    image_attribution: m.image?.attribution ?? null,
    order_path: m.orderPath ?? null,
    available: m.available,
    source: m.provenance.source,
    source_ref: m.provenance.sourceRef ?? null,
    verification: m.provenance.verification,
    verified_at: m.provenance.verifiedAt ?? null,
  };
  if (UUID_RE.test(m.id)) row.id = m.id;
  else row.catalog_key = m.id;
  return row;
}

function toListing(r: Row): DeliveryListing {
  return {
    id: r.id as string,
    restaurantId: r.restaurant_id as string,
    platform: r.platform as DeliveryListing["platform"],
    platformLabel: str(r.platform_label),
    storeUrl: str(r.store_url),
    listingStatus: r.listing_status as DeliveryListing["listingStatus"],
    offersDelivery: r.offers_delivery as DeliveryListing["offersDelivery"],
    offersPickup: r.offers_pickup as DeliveryListing["offersPickup"],
    provenance: {
      source: r.source as SourceKind,
      verification: r.verification as DeliveryListing["provenance"]["verification"],
      verifiedAt: str(r.verified_at),
    },
  };
}

function toRun(r: Row): RefreshRun {
  return {
    id: r.id as string,
    marketId: r.market_id as string,
    source: r.source as SourceKind,
    trigger: r.trigger as RefreshRun["trigger"],
    status: r.status as RefreshRun["status"],
    startedAt: String(r.started_at),
    finishedAt: str(r.finished_at),
    stats: (r.stats as Record<string, number>) ?? {},
    error: str(r.error),
  };
}

// ---------- repository ----------

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listMarkets() {
    return must(await this.db.from("markets").select("*").eq("active", true)).map(toMarket);
  }

  async listChains() {
    return must(await this.db.from("chains").select("*").order("priority")).map(toChain);
  }

  async restaurantsNear(point: { lat: number; lng: number }, radiusKm: number) {
    const near = must(await this.db.rpc("restaurants_near", { p_lat: point.lat, p_lng: point.lng, p_radius_km: radiusKm })) as {
      restaurant_id: string;
      distance_km: number;
    }[];
    if (!near.length) return [];
    const dist = new Map(near.slice(0, 400).map((n) => [n.restaurant_id, n.distance_km]));
    const rows = must(await this.db.from("restaurants").select("*").in("id", [...dist.keys()])).map(toRestaurant);
    return rows.map((restaurant) => ({ restaurant, distanceKm: dist.get(restaurant.id)! })).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getRestaurant(id: string) {
    if (!UUID_RE.test(id)) return null;
    const row = must(await this.db.from("restaurants").select("*").eq("id", id).maybeSingle());
    return row ? toRestaurant(row) : null;
  }

  async queryRestaurants(q: RestaurantQuery) {
    let query = this.db.from("restaurants").select("*", { count: "exact" });
    if (!q.includeHidden) query = query.eq("status", "active");
    if (q.marketId) query = query.eq("market_id", q.marketId);
    if (q.chainId) query = query.eq("chain_id", q.chainId);
    if (q.refreshStatus) query = query.eq("refresh_status", q.refreshStatus);
    if (q.q) query = query.or(`name.ilike.%${q.q.replace(/[%,()]/g, "")}%,address_line1.ilike.%${q.q.replace(/[%,()]/g, "")}%`);
    const offset = q.offset ?? 0;
    const res = await query.order("name").range(offset, offset + (q.limit ?? 50) - 1);
    return { rows: must(res).map(toRestaurant), total: res.count ?? 0 };
  }

  async upsertRestaurant(r: StoredRestaurant) {
    const row = fromRestaurant(r);
    const res = row.id
      ? await this.db.from("restaurants").upsert(row).select("*").single()
      : await this.db.from("restaurants").insert(row).select("*").single();
    return toRestaurant(must(res));
  }

  async resolvableIn(marketId: string) {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const page = must(
        await this.db
          .from("restaurants")
          .select("id,name,chain_id,lat,lng,phone,kind,osm_id,google_place_id,foursquare_id,content_hash")
          .eq("market_id", marketId)
          .is("duplicate_of", null)
          .range(from, from + 999),
      );
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      chainId: str(r.chain_id),
      location: { lat: Number(r.lat), lng: Number(r.lng) },
      phone: str(r.phone),
      kind: r.kind as Restaurant["kind"],
      externalIds: { osm: str(r.osm_id), google: str(r.google_place_id), foursquare: str(r.foursquare_id) },
      contentHash: str(r.content_hash),
    }));
  }

  async menuFor(restaurants: { id: string; chainId?: string }[]) {
    const out = new Map<string, MenuItem[]>();
    if (!restaurants.length) return out;
    const chainIds = [...new Set(restaurants.map((r) => r.chainId).filter(Boolean))] as string[];
    const ids = restaurants.map((r) => r.id);
    const [chainItems, localItems] = await Promise.all([
      chainIds.length ? this.db.from("menu_items").select("*").in("chain_id", chainIds).is("restaurant_id", null).eq("available", true) : { data: [], error: null },
      this.db.from("menu_items").select("*").in("restaurant_id", ids).eq("available", true),
    ]);
    const chain = must(chainItems as { data: Row[] | null; error: null }).map(toMenuItem);
    const local = must(localItems).map(toMenuItem);
    for (const r of restaurants) {
      const mine = local.filter((m) => m.restaurantId === r.id);
      const names = new Set(mine.map((m) => m.name.toLowerCase()));
      out.set(r.id, [...mine, ...chain.filter((m) => m.chainId === r.chainId && !names.has(m.name.toLowerCase()))]);
    }
    return out;
  }

  async getMenuItem(id: string) {
    const col = UUID_RE.test(id) ? "id" : "catalog_key";
    const row = must(await this.db.from("menu_items").select("*").eq(col, id).maybeSingle());
    return row ? toMenuItem(row) : null;
  }

  async upsertMenuItem(item: MenuItem) {
    const row = fromMenuItem(item);
    const conflict = row.id ? "id" : row.catalog_key ? "catalog_key" : undefined;
    const res = conflict
      ? await this.db.from("menu_items").upsert(row, { onConflict: conflict }).select("*").single()
      : await this.db.from("menu_items").insert(row).select("*").single();
    return toMenuItem(must(res));
  }

  async deleteMenuItem(id: string) {
    must(await this.db.from("menu_items").delete().eq(UUID_RE.test(id) ? "id" : "catalog_key", id));
  }

  async listingsFor(ids: string[]) {
    const out = new Map<string, DeliveryListing[]>();
    const valid = ids.filter((i) => UUID_RE.test(i));
    if (!valid.length) return out;
    for (const l of must(await this.db.from("delivery_listings").select("*").in("restaurant_id", valid)).map(toListing)) {
      out.set(l.restaurantId, [...(out.get(l.restaurantId) ?? []), l]);
    }
    return out;
  }

  async upsertListing(l: DeliveryListing) {
    const row = {
      restaurant_id: l.restaurantId,
      platform: l.platform,
      platform_label: l.platformLabel ?? null,
      store_url: l.storeUrl ?? null,
      listing_status: l.listingStatus,
      offers_delivery: l.offersDelivery,
      offers_pickup: l.offersPickup,
      source: l.provenance.source,
      verification: l.provenance.verification,
      verified_at: l.provenance.verifiedAt ?? null,
    };
    return toListing(must(await this.db.from("delivery_listings").upsert(row, { onConflict: "restaurant_id,platform" }).select("*").single()));
  }

  async deleteListing(id: string) {
    must(await this.db.from("delivery_listings").delete().eq("id", id));
  }

  async promotionsFor(restaurants: { id: string; chainId?: string }[]) {
    const today = new Date().toISOString().slice(0, 10);
    const rows = must(await this.db.from("promotions").select("*").or(`valid_until.is.null,valid_until.gte.${today}`));
    const promos: Promotion[] = rows.map((r: Row) => ({
      id: r.id as string,
      chainId: str(r.chain_id),
      restaurantId: str(r.restaurant_id),
      title: r.title as string,
      detail: str(r.detail),
      validUntil: str(r.valid_until),
      provenance: { source: r.source as SourceKind, verification: "verified", verifiedAt: str(r.verified_at) },
    }));
    return new Map(restaurants.map((r) => [r.id, promos.filter((p) => p.restaurantId === r.id || (p.chainId && p.chainId === r.chainId))]));
  }

  async upsertPromotion(p: Promotion) {
    const row: Row = {
      chain_id: p.chainId ?? null,
      restaurant_id: p.restaurantId ?? null,
      title: p.title,
      detail: p.detail ?? null,
      valid_until: p.validUntil ?? null,
      source: p.provenance.source,
      verified_at: p.provenance.verifiedAt ?? null,
    };
    if (p.id && UUID_RE.test(p.id)) row.id = p.id;
    const r = must(await this.db.from("promotions").upsert(row).select("*").single()) as Row;
    return { ...p, id: r.id as string };
  }

  async startRun(run: Omit<RefreshRun, "id" | "startedAt" | "status" | "stats">) {
    return toRun(must(await this.db.from("refresh_runs").insert({ market_id: run.marketId, source: run.source, trigger: run.trigger }).select("*").single()));
  }

  async finishRun(id: string, patch: Pick<RefreshRun, "status" | "stats"> & { error?: string }) {
    must(await this.db.from("refresh_runs").update({ ...patch, error: patch.error ?? null, finished_at: new Date().toISOString() }).eq("id", id));
  }

  async listRuns(limit = 20) {
    return must(await this.db.from("refresh_runs").select("*").order("started_at", { ascending: false }).limit(limit)).map(toRun);
  }

  async recordChanges(changes: DataChange[]) {
    for (let i = 0; i < changes.length; i += 500) {
      must(
        await this.db.from("data_changes").insert(
          changes.slice(i, i + 500).map((c) => ({
            run_id: c.runId ?? null,
            entity_type: c.entityType,
            entity_id: c.entityId,
            change_type: c.changeType,
            field: c.field ?? null,
            old_value: c.oldValue ?? null,
            new_value: c.newValue ?? null,
            source: c.source,
            detected_at: c.detectedAt,
          })),
        ),
      );
    }
  }

  async listChanges(opts: { unreviewedOnly?: boolean; limit?: number } = {}) {
    let q = this.db.from("data_changes").select("*").order("detected_at", { ascending: false }).limit(opts.limit ?? 100);
    if (opts.unreviewedOnly) q = q.is("reviewed_at", null);
    return must(await q).map(
      (r: Row): DataChange => ({
        id: Number(r.id),
        runId: str(r.run_id),
        entityType: r.entity_type as DataChange["entityType"],
        entityId: r.entity_id as string,
        changeType: r.change_type as DataChange["changeType"],
        field: str(r.field),
        oldValue: r.old_value,
        newValue: r.new_value,
        source: r.source as SourceKind,
        detectedAt: String(r.detected_at),
        reviewedAt: str(r.reviewed_at),
      }),
    );
  }

  async markChangesReviewed(ids: number[]) {
    must(await this.db.from("data_changes").update({ reviewed_at: new Date().toISOString() }).in("id", ids));
  }

  async addReport(r: Omit<UserReport, "id" | "createdAt" | "status">) {
    must(
      await this.db.from("user_reports").insert({
        restaurant_id: r.restaurantId && UUID_RE.test(r.restaurantId) ? r.restaurantId : null,
        menu_item_id: r.menuItemId && UUID_RE.test(r.menuItemId) ? r.menuItemId : null,
        kind: r.kind,
        message: r.message ? `${r.message}${r.menuItemId && !UUID_RE.test(r.menuItemId) ? ` [item ${r.menuItemId}]` : ""}` : null,
      }),
    );
  }

  async listReports(status?: UserReport["status"]) {
    let q = this.db.from("user_reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);
    return must(await q).map(
      (r: Row): UserReport => ({
        id: r.id as string,
        restaurantId: str(r.restaurant_id),
        menuItemId: str(r.menu_item_id),
        kind: r.kind as UserReport["kind"],
        message: str(r.message),
        status: r.status as UserReport["status"],
        createdAt: String(r.created_at),
      }),
    );
  }

  async setReportStatus(id: string, status: UserReport["status"]) {
    must(await this.db.from("user_reports").update({ status }).eq("id", id));
  }

  private async loadGroup(row: Row | null): Promise<Group | null> {
    if (!row || Date.parse(String(row.expires_at)) < Date.now()) return null;
    const [members, swipes] = await Promise.all([
      this.db.from("group_members").select("member_id,display_name").eq("group_id", row.id),
      this.db.from("group_swipes").select("member_id,offering_key,restaurant_id,action").eq("group_id", row.id),
    ]);
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      center: row.center_lat != null ? { lat: Number(row.center_lat), lng: Number(row.center_lng) } : undefined,
      expiresAt: String(row.expires_at),
      members: must(members).map((m: Row) => ({ memberId: m.member_id as string, displayName: m.display_name as string })),
      swipes: must(swipes).map((s: Row) => ({
        memberId: s.member_id as string,
        offeringKey: s.offering_key as string,
        restaurantId: s.restaurant_id as string,
        action: s.action as "like",
      })),
    };
  }

  async createGroup(input: { name: string; center?: { lat: number; lng: number }; memberId: string; displayName: string }) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      const res = await this.db
        .from("groups")
        .insert({ code, name: input.name, center_lat: input.center?.lat ?? null, center_lng: input.center?.lng ?? null })
        .select("*")
        .single();
      if (res.error?.code === "23505") continue;
      const row = must(res);
      must(await this.db.from("group_members").insert({ group_id: row.id, member_id: input.memberId, display_name: input.displayName }));
      return (await this.loadGroup(row))!;
    }
    throw new Error("Could not allocate a group code");
  }

  async getGroup(code: string) {
    return this.loadGroup(must(await this.db.from("groups").select("*").eq("code", code.toUpperCase()).maybeSingle()));
  }

  async joinGroup(code: string, memberId: string, displayName: string) {
    const grp = await this.getGroup(code);
    if (!grp) return null;
    if (!grp.members.some((m) => m.memberId === memberId)) {
      if (grp.members.length >= 12) return null;
      must(await this.db.from("group_members").insert({ group_id: grp.id, member_id: memberId, display_name: displayName }));
      grp.members.push({ memberId, displayName });
    }
    return grp;
  }

  async groupSwipe(code: string, s: Group["swipes"][number]) {
    const grp = await this.getGroup(code);
    if (!grp || !grp.members.some((m) => m.memberId === s.memberId)) throw new Error("not a member");
    must(
      await this.db.from("group_swipes").upsert(
        { group_id: grp.id, member_id: s.memberId, offering_key: s.offeringKey, restaurant_id: s.restaurantId, action: s.action },
        { onConflict: "group_id,member_id,offering_key" },
      ),
    );
  }
}
