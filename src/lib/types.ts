/**
 * Core CRAVE domain model.
 *
 * Every externally sourced fact carries provenance so the UI can say where it
 * came from, when it was last checked, and how much to trust it. "Listed on a
 * platform", "delivers to your address" and "accepting orders right now" are
 * deliberately three different fields.
 */

export type SourceKind =
  | "osm"
  | "google_places"
  | "foursquare"
  | "catalog"
  | "spoonacular"
  | "manual"
  | "user_report"
  | "demo";

/**
 * verified  – a person or an authorized live API confirmed it, at verifiedAt.
 * reported  – published by a data source (e.g. OSM tags), not independently checked.
 * estimate  – a typical value; never presented as a quote.
 * unknown   – we don't have it.
 */
export type Verification = "verified" | "reported" | "estimate" | "unknown";

export interface Provenance {
  source: SourceKind;
  sourceRef?: string;
  fetchedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verification: Verification;
  attribution?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Market {
  id: string;
  name: string;
  timezone: string;
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
  center: LatLng;
  /** Combined sales tax used for *estimates* only. */
  taxRate: number;
  active: boolean;
}

// ---------- Hours ----------

/** day: 0 = Sunday. Times are local wall-clock "HH:MM". close <= open means it runs past midnight. */
export interface WeeklyPeriod {
  day: number;
  open: string;
  close: string;
}

export interface SpecialHours {
  date: string; // YYYY-MM-DD, local
  closed?: boolean;
  periods?: { open: string; close: string }[];
  note?: string;
}

export interface HoursSet {
  regular: WeeklyPeriod[];
  special: SpecialHours[];
  /** Original source string, e.g. OSM opening_hours. */
  raw?: string;
  provenance: Provenance;
}

export interface RestaurantHours {
  general?: HoursSet;
  delivery?: HoursSet;
  pickup?: HoursSet;
  /** Kitchen stops taking orders this many minutes before close, when known. */
  kitchenCutoffMinutes?: number;
}

// ---------- Restaurants ----------

export type RestaurantKind = "standard" | "ghost_kitchen" | "virtual_brand" | "delivery_only";
export type ChainTier = "national" | "regional" | "local";

export interface Chain {
  id: string;
  slug: string;
  name: string;
  tier: ChainTier;
  /** Lower = ingested and ranked first for data work. */
  priority: number;
  wikidata?: string;
  /** Alternate spellings seen in OSM/Google for matching. */
  aliases: string[];
  website?: string;
  /** Restaurant-owned ordering (site/app). */
  directOrderUrl?: string;
  categories: string[];
  priceLevel?: 1 | 2 | 3 | 4;
}

export interface Address {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Rating {
  value: number;
  count?: number;
  source: SourceKind;
  url?: string;
  fetchedAt: string;
}

export type TriState = "yes" | "no" | "unknown";

export interface Restaurant {
  id: string;
  marketId: string;
  chainId?: string;
  name: string;
  kind: RestaurantKind;
  /** For virtual brands / ghost kitchens: the physical kitchen they operate from. */
  hostRestaurantId?: string;
  address: Address;
  location: LatLng;
  phone?: string;
  website?: string;
  cuisine: string[];
  priceLevel?: 1 | 2 | 3 | 4;
  hours: RestaurantHours;
  rating?: Rating;
  pickup: TriState;
  externalIds: { osm?: string; google?: string; foursquare?: string };
  provenance: Provenance;
  status: "active" | "closed_permanently" | "hidden";
  isDemo: boolean;
  updatedAt: string;
}

// ---------- Delivery ----------

export type DeliveryPlatform = "doordash" | "ubereats" | "grubhub" | "direct" | "other";

/** Is the store on the platform at all? */
export type ListingStatus = "verified_listed" | "reported_listed" | "not_listed" | "unknown";
/** Does the platform deliver from this store to *this* address? */
export type CoverageStatus = "in_area" | "out_of_area" | "unverified";
/** Is the platform accepting delivery orders from this store right now? */
export type LiveStatus = "accepting" | "not_accepting" | "unknown";

export interface DeliveryListing {
  id: string;
  restaurantId: string;
  platform: DeliveryPlatform;
  platformLabel?: string;
  storeUrl?: string;
  listingStatus: ListingStatus;
  offersDelivery: TriState;
  offersPickup: TriState;
  provenance: Provenance;
}

/** Address-specific, moment-specific answer. Only an authorized live adapter may fill these. */
export interface DeliveryQuote {
  platform: DeliveryPlatform;
  coverage: CoverageStatus;
  live: LiveStatus;
  etaMinutes?: [number, number];
  deliveryFee?: number;
  serviceFee?: number;
  minimumOrder?: number;
  fetchedAt?: string;
  source: SourceKind | "none";
}

// ---------- Menu ----------

export const FOOD_CATEGORIES = [
  "burgers",
  "chicken",
  "pizza",
  "sandwiches",
  "tacos",
  "mexican",
  "breakfast",
  "salads",
  "bowls",
  "asian",
  "seafood",
  "hot dogs",
  "sides",
  "desserts",
  "drinks",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface Price {
  amount?: number;
  low?: number;
  high?: number;
  currency: "USD";
  status: Verification;
  source: SourceKind;
  /** Which channel the price was observed on — in-store and delivery menus differ. */
  channel?: "in_store" | "direct_online" | DeliveryPlatform;
  verifiedAt?: string;
}

export type PortionSize = "snack" | "regular" | "large" | "shareable";

export interface Nutrition {
  calories?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  sodiumMg?: number;
  provenance: Provenance;
}

export interface MenuItem {
  id: string;
  /** Chain-wide item (applies to every branch unless overridden). */
  chainId?: string;
  /** Location-specific item or override. */
  restaurantId?: string;
  name: string;
  description?: string;
  category: FoodCategory;
  ingredients: string[];
  price: Price;
  comboPrice?: Price;
  isCombo: boolean;
  portion: { size: PortionSize; note?: string };
  nutrition?: Nutrition;
  allergens?: { contains: string[]; provenance: Provenance };
  /** Only populated from a verified source. */
  dietary: string[];
  image?: { url: string; kind: "official" | "licensed" | "representative"; attribution?: string };
  /** Deep link to the item where the provider supports it. */
  orderPath?: string;
  available: boolean;
  provenance: Provenance;
}

export interface Promotion {
  id: string;
  chainId?: string;
  restaurantId?: string;
  title: string;
  detail?: string;
  validUntil?: string;
  provenance: Provenance;
}

// ---------- Discovery feed ----------

export interface HoursStatus {
  state: "open" | "closed" | "closing_soon" | "unknown";
  label: string;
  minutesUntilClose?: number;
  minutesUntilOpen?: number;
  closesAt?: string;
  opensAt?: string;
  todayLabel?: string;
}

/** A listing as shown to the user, with the link we'd hand them off to. */
export interface ListingView extends DeliveryListing {
  /** Generated search link rather than a stored listing — not evidence of presence. */
  synthetic: boolean;
  url?: string;
  urlKind: "verified_store" | "store" | "search" | "direct_site" | "none";
  capabilities: { addressCoverage: boolean; liveQuote: boolean };
}

export interface Offering {
  key: string; // `${restaurantId}:${itemId}`
  item: MenuItem;
  restaurant: Restaurant;
  chain?: Chain;
  distanceKm: number;
  hours: HoursStatus;
  deliveryHours?: HoursStatus;
  listings: ListingView[];
  promotions: Promotion[];
  value: { score: number; label: string };
  score: number;
  reasons: string[];
}

// ---------- User preferences ----------

export type DeliveryMode = "delivery" | "pickup" | "both";
export type SwipeAction = "like" | "pass" | "save";

export interface SwipeEvent {
  key: string;
  itemId: string;
  restaurantId: string;
  chainId?: string;
  category: FoodCategory;
  ingredients: string[];
  price?: number;
  portion: PortionSize;
  action: SwipeAction;
  at: string;
}

/** Permanent: never show this restaurant/chain again until the user unblocks it. */
export interface Block {
  type: "restaurant" | "chain";
  id: string;
  name: string;
  at: string;
}

/** Temporary: "not tonight" or "tired of it" — expires. */
export interface TemporaryDislike {
  type: "restaurant" | "chain" | "category";
  id: string;
  name: string;
  reason: "not_tonight" | "tired_of";
  until: string;
}

/** Individual meal: never show this exact item again. */
export interface MealRejection {
  itemId: string;
  name: string;
  at: string;
}

export interface RecentMeal {
  restaurantId: string;
  chainId?: string;
  name: string;
  at: string;
}

export interface RankingWeights {
  taste: number;
  price: number;
  distance: number;
  value: number;
  variety: number;
  openness: number;
}

export interface Filters {
  categories: FoodCategory[];
  ingredients: string[];
  chains: string[];
  platforms: DeliveryPlatform[];
  budget: { max?: number; min?: number; includeDeliveryCosts: boolean };
  maxDistanceKm?: number;
  minRating?: number;
  portion?: PortionSize[];
  openNow: boolean;
  deliveryNow: boolean;
  openAtLeastMinutes?: number;
  laterTonight: boolean;
  dealsOnly: boolean;
  dietary: string[];
  visited: "any" | "only" | "exclude";
  newOnly: boolean;
  includeClosed: boolean;
  includeUnknownPrices: boolean;
  includeUnverifiedAllergens: boolean;
}

export interface UserProfile {
  onboarded: boolean;
  displayName?: string;
  location?: {
    label: string;
    point: LatLng;
    precision: "exact" | "approximate";
    source: "geolocation" | "address";
  };
  mode: DeliveryMode;
  tastes: Partial<Record<FoodCategory, number>>; // -2..2
  dietary: string[];
  allergens: string[];
  portionPreference: "light" | "regular" | "hearty" | "any";
  budgetMax?: number;
  tipPercent: number;
  /** User's own assumption for delivery + service fees, used only for estimates. */
  assumedDeliveryCost: number;
  weights: RankingWeights;
  demoMode: boolean;
}

export interface PreferenceState {
  profile: UserProfile;
  filters: Filters;
  swipes: SwipeEvent[];
  blocks: Block[];
  dislikes: TemporaryDislike[];
  rejections: MealRejection[];
  recentMeals: RecentMeal[];
}
