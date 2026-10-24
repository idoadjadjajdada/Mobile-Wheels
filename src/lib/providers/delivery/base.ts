import type { Chain, DeliveryListing, DeliveryPlatform, DeliveryQuote, LatLng, Restaurant } from "../../types";
import { NotAuthorizedError } from "../http";
import type { DeliveryAdapter, DeliveryCapabilities, ProviderInfo } from "../types";

/**
 * A delivery platform without an authorized data integration. It can only:
 *   - build a public search link (no data collection), and
 *   - use a store URL an admin verified by hand.
 * It never claims coverage, live availability, fees or ETAs.
 *
 * To add an authorized integration later, subclass and override
 * `capabilities()`, `lookupListing()` and/or `quote()`. Nothing else changes.
 */
export abstract class LinkOnlyDeliveryAdapter implements DeliveryAdapter {
  abstract platform: DeliveryPlatform;
  abstract label: string;
  protected abstract accessNote: string;
  protected abstract docsUrl: string;

  info(): ProviderInfo {
    return {
      id: this.platform,
      name: this.label,
      kinds: ["delivery"],
      requires: [],
      configured: true,
      storable: true,
      licensing: this.accessNote,
      cost: "Link-out only: free.",
      docsUrl: this.docsUrl,
    };
  }

  capabilities(): DeliveryCapabilities {
    return { listingLookup: false, addressCoverage: false, liveQuote: false, deepLink: true, itemDeepLink: false, manualListing: true };
  }

  abstract searchUrl(r: Pick<Restaurant, "name" | "address" | "location">, chain?: Chain): string | undefined;

  orderUrl(r: Restaurant, listing: DeliveryListing | undefined, chain?: Chain): string | undefined {
    if (listing?.storeUrl && listing.listingStatus !== "not_listed") return listing.storeUrl;
    if (listing?.listingStatus === "not_listed") return undefined;
    return this.searchUrl(r, chain);
  }

  async lookupListing(_r: Restaurant): Promise<Partial<DeliveryListing> | undefined> {
    throw new NotAuthorizedError(this.label, "listing lookup");
  }

  async quote(_listing: DeliveryListing, _address: LatLng): Promise<DeliveryQuote> {
    // Not an error for callers: an honest "we can't know".
    return { platform: this.platform, coverage: "unverified", live: "unknown", source: "none" };
  }
}

export function searchTerm(r: Pick<Restaurant, "name">, chain?: Chain) {
  return chain?.name ?? r.name;
}
