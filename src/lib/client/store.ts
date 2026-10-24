"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_FILTERS, DEFAULT_PROFILE, emptyState } from "../defaults";
import type { Block, Filters, Offering, PreferenceState, SwipeAction, SwipeEvent, TemporaryDislike, UserProfile } from "../types";

/**
 * Client state. Preferences live on the device (localStorage) so CRAVE works
 * without an account; signed-in users additionally sync to Supabase (sync.ts).
 * Every localStorage access is guarded: private mode and blocked storage just
 * mean nothing persists, never a crash.
 */

export interface AppState extends PreferenceState {
  /** Offerings the user liked/saved, kept so the shortlist works offline. */
  saved: Record<string, Offering>;
  undo: { event: SwipeEvent; offering: Offering }[];
  lastDeck?: { at: string; count: number };
  group?: { code: string; memberId: string; displayName: string };
  memberId: string;
}

const KEY = "crave:v1";
const listeners = new Set<() => void>();
let hydrated = false;

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}

function initial(): AppState {
  return { ...emptyState(), saved: {}, undo: [], memberId: "00000000-0000-4000-8000-000000000000" };
}

let state: AppState = initial();
const serverSnapshot = initial();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        ...initial(),
        ...parsed,
        profile: { ...DEFAULT_PROFILE, ...parsed.profile, weights: { ...DEFAULT_PROFILE.weights, ...parsed.profile?.weights } },
        filters: { ...DEFAULT_FILTERS, ...parsed.filters, budget: { ...DEFAULT_FILTERS.budget, ...parsed.filters?.budget } },
        undo: [],
        memberId: parsed.memberId ?? uuid(),
      };
    }
  } catch {
    // ignore
  }
  return { ...initial(), memberId: uuid() };
}

function persist() {
  try {
    const { undo: _undo, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // storage full or blocked — keep working in memory
  }
}

export function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = load();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function setState(fn: (s: AppState) => AppState) {
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(serverSnapshot),
  );
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );
}

/** Snapshot sent to the server for ranking. */
export function preferenceSnapshot(s: AppState = state): PreferenceState {
  const cut = Date.now() - 180 * 86_400_000;
  return {
    profile: s.profile,
    filters: s.filters,
    swipes: s.swipes.filter((x) => Date.parse(x.at) > cut).slice(-2500),
    blocks: s.blocks,
    dislikes: s.dislikes.filter((d) => Date.parse(d.until) > Date.now()),
    rejections: s.rejections,
    recentMeals: s.recentMeals.filter((m) => Date.parse(m.at) > Date.now() - 30 * 86_400_000),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function priceOf(o: Offering) {
  const p = o.item.price;
  return p.amount ?? (p.low != null ? ((p.low ?? 0) + (p.high ?? p.low ?? 0)) / 2 : undefined);
}

export function swipe(o: Offering, action: SwipeAction): SwipeEvent {
  const event: SwipeEvent = {
    key: o.key,
    itemId: o.item.id,
    restaurantId: o.restaurant.id,
    chainId: o.restaurant.chainId,
    category: o.item.category,
    ingredients: o.item.ingredients,
    price: priceOf(o),
    portion: o.item.portion.size,
    action,
    at: new Date().toISOString(),
  };
  setState((s) => {
    const saved = { ...s.saved };
    if (action === "pass") delete saved[o.key];
    else saved[o.key] = o;
    return { ...s, swipes: [...s.swipes, event].slice(-3000), saved, undo: [...s.undo, { event, offering: o }].slice(-20) };
  });
  return event;
}

export function undoLast(): Offering | undefined {
  const last = state.undo[state.undo.length - 1];
  if (!last) return undefined;
  setState((s) => {
    const idx = s.swipes.findLastIndex((x) => x.key === last.event.key && x.at === last.event.at);
    const swipes = idx >= 0 ? [...s.swipes.slice(0, idx), ...s.swipes.slice(idx + 1)] : s.swipes;
    const saved = { ...s.saved };
    if (last.event.action !== "pass") delete saved[last.event.key];
    // Undo also reverts any preference recorded from that card's follow-up prompt.
    const rejections = s.rejections.filter((r) => !(r.itemId === last.offering.item.id && Date.parse(r.at) >= Date.parse(last.event.at)));
    return { ...s, swipes, saved, rejections, undo: s.undo.slice(0, -1) };
  });
  return last.offering;
}

export function setSavedAction(key: string, action: "like" | "save") {
  setState((s) => {
    const o = s.saved[key];
    if (!o) return s;
    return { ...s, swipes: [...s.swipes, { ...s.swipes.findLast((x) => x.key === key)!, action, at: new Date().toISOString() }] };
  });
}

export function removeSaved(key: string) {
  setState((s) => {
    const saved = { ...s.saved };
    const o = saved[key];
    delete saved[key];
    const swipes = o ? [...s.swipes.filter((x) => x.key !== key)] : s.swipes;
    return { ...s, saved, swipes };
  });
}

export function block(b: Omit<Block, "at">) {
  setState((s) => ({
    ...s,
    blocks: [...s.blocks.filter((x) => !(x.type === b.type && x.id === b.id)), { ...b, at: new Date().toISOString() }],
    // A permanent block supersedes any temporary dislike of the same target.
    dislikes: s.dislikes.filter((d) => !(d.type === b.type && d.id === b.id)),
  }));
}

export function unblock(type: Block["type"], id: string) {
  setState((s) => ({ ...s, blocks: s.blocks.filter((x) => !(x.type === type && x.id === id)) }));
}

export function dislike(d: Omit<TemporaryDislike, "until">, hours: number) {
  const until = new Date(Date.now() + hours * 3_600_000).toISOString();
  setState((s) => ({ ...s, dislikes: [...s.dislikes.filter((x) => !(x.type === d.type && x.id === d.id)), { ...d, until }] }));
}

export function removeDislike(type: TemporaryDislike["type"], id: string) {
  setState((s) => ({ ...s, dislikes: s.dislikes.filter((x) => !(x.type === type && x.id === id)) }));
}

export function rejectMeal(itemId: string, name: string) {
  setState((s) => ({ ...s, rejections: [...s.rejections.filter((r) => r.itemId !== itemId), { itemId, name, at: new Date().toISOString() }] }));
}

export function unrejectMeal(itemId: string) {
  setState((s) => ({ ...s, rejections: s.rejections.filter((r) => r.itemId !== itemId) }));
}

export function ateHere(o: Pick<Offering, "restaurant" | "chain">) {
  setState((s) => ({
    ...s,
    recentMeals: [...s.recentMeals, { restaurantId: o.restaurant.id, chainId: o.restaurant.chainId, name: o.chain?.name ?? o.restaurant.name, at: new Date().toISOString() }].slice(-200),
  }));
}

export function updateProfile(patch: Partial<UserProfile>) {
  setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
}

export function updateFilters(patch: Partial<Filters>) {
  setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
}

export function resetFilters() {
  setState((s) => ({ ...s, filters: structuredClone(DEFAULT_FILTERS) }));
}

/** Clears learned taste + swipe history but keeps location, blocks and settings. */
export function resetPreferences() {
  setState((s) => ({
    ...s,
    swipes: [],
    undo: [],
    dislikes: [],
    rejections: [],
    recentMeals: [],
    profile: { ...s.profile, tastes: {}, weights: DEFAULT_PROFILE.weights },
  }));
}

export function resetEverything() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  state = { ...initial(), memberId: uuid() };
  listeners.forEach((l) => l());
}

export function setGroup(g: AppState["group"]) {
  setState((s) => ({ ...s, group: g }));
}

export function markDeck(count: number) {
  setState((s) => ({ ...s, lastDeck: { at: new Date().toISOString(), count } }));
}
