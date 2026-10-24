"use client";

import type { DeckMeta, RestaurantDetail } from "../discovery";
import type { LatLng, Offering, PreferenceState } from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(typeof navigator !== "undefined" && !navigator.onLine ? "You're offline." : "Couldn't reach CRAVE. Check your connection.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(body.error ?? `Request failed (${res.status})`), res.status, body);
  return body as T;
}

export type { DeckMeta, RestaurantDetail };

export const api = {
  deck: (point: LatLng, state: PreferenceState) =>
    call<{ offerings: Offering[]; meta: DeckMeta }>("/api/deck", { method: "POST", body: JSON.stringify({ point, state }) }),
  offerings: (keys: string[], point: LatLng | undefined, state: PreferenceState) =>
    call<{ offerings: Offering[] }>("/api/offerings", { method: "POST", body: JSON.stringify({ keys, point, state }) }),
  restaurant: (id: string, point: LatLng | undefined, state: PreferenceState) =>
    call<RestaurantDetail>(`/api/restaurants/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ point, state }) }),
  geocode: (q: string) => call<{ results: { label: string; point: LatLng; precision: string }[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),
  reverse: (p: LatLng) => call<{ label: string | null }>(`/api/geocode/reverse?lat=${p.lat}&lng=${p.lng}`),
  report: (r: { restaurantId?: string; menuItemId?: string; kind: string; message?: string }) =>
    call<{ ok: true }>("/api/reports", { method: "POST", body: JSON.stringify(r) }),
  status: () => call<{ store: "supabase" | "local"; auth: boolean; liveDeliveryVerification: boolean }>("/api/status"),
  createGroup: (b: { name: string; memberId: string; displayName: string; center?: LatLng }) =>
    call<{ code: string }>("/api/groups", { method: "POST", body: JSON.stringify(b) }),
  joinGroup: (code: string, b: { memberId: string; displayName: string }) =>
    call<{ ok: true; code: string; center?: LatLng }>(`/api/groups/${encodeURIComponent(code)}/join`, { method: "POST", body: JSON.stringify(b) }),
  group: (code: string, memberId: string) =>
    call<{
      code: string;
      name: string;
      center?: LatLng;
      expiresAt: string;
      members: { displayName: string; isMe: boolean; swipes: number }[];
      matches: string[];
      restaurantMatches: string[];
      mySwipes: string[];
    }>(`/api/groups/${encodeURIComponent(code)}?member=${encodeURIComponent(memberId)}`),
  groupSwipe: (code: string, b: { memberId: string; offeringKey: string; restaurantId: string; action: string }) =>
    call<{ ok: true }>(`/api/groups/${encodeURIComponent(code)}/swipe`, { method: "POST", body: JSON.stringify(b) }),
};
