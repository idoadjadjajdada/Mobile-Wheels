import type { LatLng } from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function kmToMiles(km: number) {
  return km * 0.621371;
}

export function formatDistance(km: number) {
  const mi = kmToMiles(km);
  return mi < 0.1 ? "< 0.1 mi" : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/** Round coordinates for anything that leaves the device without consent for precision (~1 km). */
export function coarsen(p: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}
