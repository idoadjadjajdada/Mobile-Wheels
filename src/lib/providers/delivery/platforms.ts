import type { Chain, DeliveryListing, Restaurant } from "../../types";
import { LinkOnlyDeliveryAdapter, searchTerm } from "./base";
import type { DeliveryCapabilities, ProviderInfo } from "../types";

export class DoorDashAdapter extends LinkOnlyDeliveryAdapter {
  platform = "doordash" as const;
  label = "DoorDash";
  protected accessNote =
    "Marketplace APIs are limited-access for merchants/POS partners; consumer site ToS prohibit automated access. Link-out + manual verification only.";
  protected docsUrl = "https://developer.doordash.com/en-US/docs/marketplace/overview/getting_started/general_integration_requirements/";

  searchUrl(r: Pick<Restaurant, "name">, chain?: Chain) {
    return `https://www.doordash.com/search/store/${encodeURIComponent(searchTerm(r, chain))}/`;
  }
}

export class UberEatsAdapter extends LinkOnlyDeliveryAdapter {
  platform = "ubereats" as const;
  label = "Uber Eats";
  protected accessNote =
    "Marketplace APIs require written approval and are scoped to merchants' own stores; API terms ban crawlers. Link-out + manual verification only.";
  protected docsUrl = "https://developer.uber.com/docs/eats/introduction";

  searchUrl(r: Pick<Restaurant, "name">, chain?: Chain) {
    return `https://www.ubereats.com/search?q=${encodeURIComponent(searchTerm(r, chain))}`;
  }
}

export class GrubhubAdapter extends LinkOnlyDeliveryAdapter {
  platform = "grubhub" as const;
  label = "Grubhub";
  protected accessNote = "Partner APIs are for POS/integration partners acting for merchants. Link-out + manual verification only.";
  protected docsUrl = "https://developer.grubhub.com/";

  searchUrl(r: Pick<Restaurant, "name" | "location">, chain?: Chain) {
    const params = new URLSearchParams({
      queryText: searchTerm(r, chain),
      latitude: r.location.lat.toFixed(5),
      longitude: r.location.lng.toFixed(5),
    });
    return `https://www.grubhub.com/search?${params}`;
  }
}

/** Restaurant-owned ordering (chain site/app or the restaurant's own website). */
export class DirectOrderAdapter extends LinkOnlyDeliveryAdapter {
  platform = "direct" as const;
  label = "Order direct";
  protected accessNote = "Links to the restaurant's or chain's own ordering site.";
  protected docsUrl = "";

  searchUrl(r: Pick<Restaurant, "name" | "address" | "location"> & { website?: string }, chain?: Chain) {
    return chain?.directOrderUrl ?? r.website;
  }

  orderUrl(r: Restaurant, listing: DeliveryListing | undefined, chain?: Chain) {
    return listing?.storeUrl ?? chain?.directOrderUrl ?? r.website;
  }
}

/**
 * MealMe-style aggregator slot. Disabled by default: upstream data provenance
 * must pass legal review against platform terms before enabling.
 */
export class AggregatorAdapterStub extends LinkOnlyDeliveryAdapter {
  platform = "other" as const;
  label = "Aggregator (disabled)";
  protected accessNote = "Disabled pending legal review of upstream data licensing.";
  protected docsUrl = "https://docs.mealme.ai/";

  info(): ProviderInfo {
    return {
      ...super.info(),
      id: "aggregator",
      requires: ["MEALME_API_KEY"],
      configured: !!process.env.MEALME_API_KEY,
      cost: "~$0.10/call or ~$250/mo (published pricing at time of assessment).",
      disabledReason: "Requires legal review of upstream data licensing before enabling.",
    };
  }

  capabilities(): DeliveryCapabilities {
    return { listingLookup: false, addressCoverage: false, liveQuote: false, deepLink: false, itemDeepLink: false, manualListing: false };
  }

  searchUrl() {
    return undefined;
  }
}
