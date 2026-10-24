import type {
  Address,
  Chain,
  DeliveryListing,
  DeliveryPlatform,
  DeliveryQuote,
  LatLng,
  MenuItem,
  Rating,
  Restaurant,
  SourceKind,
  TriState,
} from "../types";

export type ProviderKind = "discovery" | "geocoding" | "menu" | "delivery" | "ratings" | "imagery";

export interface ProviderInfo {
  id: string;
  name: string;
  kinds: ProviderKind[];
  /** Env vars required; empty for keyless providers. */
  requires: string[];
  configured: boolean;
  /** Can we persist what it returns? (OSM yes; Google no, beyond place_id.) */
  storable: boolean;
  licensing: string;
  cost: string;
  docsUrl: string;
  /** Disabled pending legal/business review even if configured. */
  disabledReason?: string;
}

export interface DiscoveredPlace {
  source: SourceKind;
  sourceRef: string;
  name: string;
  brand?: string;
  brandWikidata?: string;
  location: LatLng;
  address: Address;
  phone?: string;
  website?: string;
  cuisine: string[];
  amenity?: string;
  openingHoursRaw?: string;
  /** OSM delivery=* / takeaway=* tags, when present. Reported, not verified. */
  deliveryTag: TriState;
  takeawayTag: TriState;
  rating?: Rating;
  /** Raw payload; only kept when the provider's terms allow storage. */
  raw?: unknown;
}

export interface DiscoveryArea {
  bbox: [number, number, number, number];
}

export interface DiscoveryProvider {
  info(): ProviderInfo;
  discover(area: DiscoveryArea, opts?: { brandsOnly?: boolean; signal?: AbortSignal }): Promise<DiscoveredPlace[]>;
}

export interface GeocodeResult {
  label: string;
  point: LatLng;
  source: SourceKind | "census";
  precision: "rooftop" | "interpolated" | "approximate";
}

export interface GeocodingProvider {
  info(): ProviderInfo;
  geocode(query: string): Promise<GeocodeResult[]>;
  reverse?(point: LatLng): Promise<GeocodeResult | undefined>;
}

export interface MenuProvider {
  info(): ProviderInfo;
  /** Items for a chain (chain-wide). */
  menuForChain?(chain: Chain): Promise<MenuItem[]>;
  /** Fill nutrition on an item, never prices. */
  enrichNutrition?(item: MenuItem, chain?: Chain): Promise<MenuItem>;
}

export interface DeliveryCapabilities {
  /** Look up whether a store is listed on the platform. */
  listingLookup: boolean;
  /** Check whether a store delivers to a specific address. */
  addressCoverage: boolean;
  /** Live fees / ETA / accepting-orders state. */
  liveQuote: boolean;
  /** Public search link (no data collection). */
  deepLink: boolean;
  /** Can link straight to a menu item. */
  itemDeepLink: boolean;
  /** Admin can attach a verified store URL. */
  manualListing: boolean;
}

export interface DeliveryAdapter {
  platform: DeliveryPlatform;
  label: string;
  info(): ProviderInfo;
  capabilities(): DeliveryCapabilities;
  /** Public search URL for this restaurant near the user. Always safe: it's a link. */
  searchUrl(r: Pick<Restaurant, "name" | "address" | "location">, chain?: Chain): string | undefined;
  /** Best URL to send the user to: verified store URL first, else search. */
  orderUrl(r: Restaurant, listing: DeliveryListing | undefined, chain?: Chain): string | undefined;
  /** Authorized integrations only. Default adapters throw NotAuthorizedError. */
  lookupListing(r: Restaurant): Promise<Partial<DeliveryListing> | undefined>;
  quote(listing: DeliveryListing, address: LatLng): Promise<DeliveryQuote>;
}

export interface RatingsProvider {
  info(): ProviderInfo;
  ratingFor(r: Restaurant): Promise<Rating | undefined>;
}
