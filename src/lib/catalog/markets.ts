import type { Market } from "../types";

/**
 * Supported markets. Expansion = add a row here (and in the `markets` table):
 * bbox, IANA timezone, and the combined sales-tax rate used for *estimates*.
 */
export const MARKETS: Market[] = [
  {
    id: "tucson",
    name: "Tucson, AZ",
    // Arizona doesn't observe DST (outside the Navajo Nation), but we never hardcode that — the IANA zone handles it.
    timezone: "America/Phoenix",
    bbox: [32.03, -111.15, 32.45, -110.72],
    center: { lat: 32.2226, lng: -110.9747 },
    // AZ 5.6% + Pima County 0.5% + City of Tucson 2.6%. Estimate only; suburbs differ.
    taxRate: 0.087,
    active: true,
  },
];

export const MARKET_BY_ID = new Map(MARKETS.map((m) => [m.id, m]));

export function marketForPoint(lat: number, lng: number): Market | undefined {
  return MARKETS.find((m) => m.active && lat >= m.bbox[0] && lat <= m.bbox[2] && lng >= m.bbox[1] && lng <= m.bbox[3]);
}
