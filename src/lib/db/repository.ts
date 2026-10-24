import type { ResolvableRecord } from "../dedupe";
import type { Chain, DeliveryListing, Market, MenuItem, Promotion, Restaurant, SourceKind } from "../types";

export interface StoredRestaurant extends Restaurant {
  lockedFields: string[];
  contentHash?: string;
  refreshStatus: "fresh" | "stale" | "pending" | "failed" | "manual_only";
  lastRefreshedAt?: string;
  duplicateOf?: string;
}

export interface RefreshRun {
  id: string;
  marketId: string;
  source: SourceKind;
  trigger: "schedule" | "manual" | "cli";
  status: "running" | "succeeded" | "failed" | "partial";
  startedAt: string;
  finishedAt?: string;
  stats: Record<string, number>;
  error?: string;
}

export interface DataChange {
  id?: number;
  runId?: string;
  entityType: "restaurant" | "menu_item" | "delivery_listing" | "chain";
  entityId: string;
  changeType: "created" | "updated" | "removed" | "skipped_locked";
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  source: SourceKind;
  detectedAt: string;
  reviewedAt?: string;
}

export interface UserReport {
  id: string;
  restaurantId?: string;
  menuItemId?: string;
  kind: "hours" | "price" | "closed" | "delivery" | "menu" | "other";
  message?: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

export interface Group {
  id: string;
  code: string;
  name: string;
  center?: { lat: number; lng: number };
  expiresAt: string;
  members: { memberId: string; displayName: string }[];
  swipes: { memberId: string; offeringKey: string; restaurantId: string; action: "like" | "pass" | "save" }[];
}

export interface RestaurantQuery {
  marketId?: string;
  q?: string;
  chainId?: string;
  refreshStatus?: StoredRestaurant["refreshStatus"];
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}

export interface Repository {
  readonly mode: "supabase" | "local";

  listMarkets(): Promise<Market[]>;
  listChains(): Promise<Chain[]>;

  restaurantsNear(point: { lat: number; lng: number }, radiusKm: number): Promise<{ restaurant: StoredRestaurant; distanceKm: number }[]>;
  getRestaurant(id: string): Promise<StoredRestaurant | null>;
  queryRestaurants(q: RestaurantQuery): Promise<{ rows: StoredRestaurant[]; total: number }>;
  upsertRestaurant(r: StoredRestaurant): Promise<StoredRestaurant>;
  resolvableIn(marketId: string): Promise<(ResolvableRecord & { externalIds: Restaurant["externalIds"]; contentHash?: string })[]>;

  menuFor(restaurants: Pick<Restaurant, "id" | "chainId">[]): Promise<Map<string, MenuItem[]>>;
  getMenuItem(id: string): Promise<MenuItem | null>;
  upsertMenuItem(item: MenuItem): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;

  listingsFor(restaurantIds: string[]): Promise<Map<string, DeliveryListing[]>>;
  upsertListing(l: DeliveryListing): Promise<DeliveryListing>;
  deleteListing(id: string): Promise<void>;

  promotionsFor(restaurants: Pick<Restaurant, "id" | "chainId">[]): Promise<Map<string, Promotion[]>>;
  upsertPromotion(p: Promotion): Promise<Promotion>;

  startRun(run: Omit<RefreshRun, "id" | "startedAt" | "status" | "stats">): Promise<RefreshRun>;
  finishRun(id: string, patch: Pick<RefreshRun, "status" | "stats"> & { error?: string }): Promise<void>;
  listRuns(limit?: number): Promise<RefreshRun[]>;
  recordChanges(changes: DataChange[]): Promise<void>;
  listChanges(opts?: { unreviewedOnly?: boolean; limit?: number }): Promise<DataChange[]>;
  markChangesReviewed(ids: number[]): Promise<void>;

  addReport(r: Omit<UserReport, "id" | "createdAt" | "status">): Promise<void>;
  listReports(status?: UserReport["status"]): Promise<UserReport[]>;
  setReportStatus(id: string, status: UserReport["status"]): Promise<void>;

  createGroup(g: { name: string; center?: { lat: number; lng: number }; memberId: string; displayName: string }): Promise<Group>;
  getGroup(code: string): Promise<Group | null>;
  joinGroup(code: string, memberId: string, displayName: string): Promise<Group | null>;
  groupSwipe(code: string, s: Group["swipes"][number]): Promise<void>;
}
