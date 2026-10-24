import type { DeliveryPlatform } from "../types";
import { FoursquareProvider } from "./discovery/foursquare";
import { GooglePlacesProvider } from "./discovery/google";
import { OsmOverpassProvider } from "./discovery/osm";
import { AggregatorAdapterStub, DirectOrderAdapter, DoorDashAdapter, GrubhubAdapter, UberEatsAdapter } from "./delivery/platforms";
import { CensusGeocoder, GoogleGeocoder, NominatimGeocoder } from "./geocoding";
import { SpoonacularMenuProvider } from "./menu/spoonacular";
import type { DeliveryAdapter, ProviderInfo } from "./types";

/** Single place that knows which adapters exist. Add a provider here and it shows up everywhere. */
export const providers = {
  osm: new OsmOverpassProvider(),
  google: new GooglePlacesProvider(),
  foursquare: new FoursquareProvider(),
  census: new CensusGeocoder(),
  nominatim: new NominatimGeocoder(),
  googleGeocoder: new GoogleGeocoder(),
  spoonacular: new SpoonacularMenuProvider(),
};

export const deliveryAdapters: Record<DeliveryPlatform, DeliveryAdapter> = {
  doordash: new DoorDashAdapter(),
  ubereats: new UberEatsAdapter(),
  grubhub: new GrubhubAdapter(),
  direct: new DirectOrderAdapter(),
  other: new AggregatorAdapterStub(),
};

export const DELIVERY_PLATFORMS: DeliveryPlatform[] = ["direct", "doordash", "ubereats", "grubhub"];

export const geocoders = [providers.census, providers.googleGeocoder, providers.nominatim];

export function allProviderInfo(): (ProviderInfo & { capabilities?: ReturnType<DeliveryAdapter["capabilities"]> })[] {
  return [
    providers.osm.info(),
    providers.google.info(),
    providers.foursquare.info(),
    providers.census.info(),
    providers.nominatim.info(),
    providers.googleGeocoder.info(),
    providers.spoonacular.info(),
    ...Object.values(deliveryAdapters).map((a) => ({ ...a.info(), capabilities: a.capabilities() })),
  ];
}
