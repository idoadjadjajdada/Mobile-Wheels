"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getState, setState } from "./store";

/**
 * Optional account sync. Anonymous use keeps everything on-device; signing in
 * mirrors preferences to Supabase (owner-only RLS) so they follow you across
 * devices. Precise location is only uploaded if the user saves an address.
 */

let client: SupabaseClient | null = null;

export function syncAvailable() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function sb() {
  if (!syncAvailable()) return null;
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}

const SYNC_KEY = "crave:lastSync";

export async function pushAll(): Promise<void> {
  const c = sb();
  if (!c) return;
  const { data } = await c.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  const s = getState();
  const { location, ...settings } = s.profile;
  const since = (() => {
    try {
      return localStorage.getItem(SYNC_KEY) ?? "1970-01-01";
    } catch {
      return "1970-01-01";
    }
  })();
  const err = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  };

  err(await c.from("profiles").update({ settings, filters: s.filters }).eq("id", uid));
  err(await c.from("user_blocks").delete().eq("user_id", uid));
  if (s.blocks.length) err(await c.from("user_blocks").insert(s.blocks.map((b) => ({ user_id: uid, target_type: b.type, target_id: b.id, target_name: b.name, created_at: b.at }))));
  err(await c.from("user_dislikes").delete().eq("user_id", uid));
  const live = s.dislikes.filter((d) => Date.parse(d.until) > Date.now());
  if (live.length) err(await c.from("user_dislikes").insert(live.map((d) => ({ user_id: uid, target_type: d.type, target_id: d.id, target_name: d.name, reason: d.reason, expires_at: d.until }))));
  err(await c.from("user_meal_rejections").delete().eq("user_id", uid));
  if (s.rejections.length) err(await c.from("user_meal_rejections").insert(s.rejections.map((r) => ({ user_id: uid, menu_item_id: r.itemId, item_name: r.name, created_at: r.at }))));
  const newSwipes = s.swipes.filter((x) => x.at > since);
  for (let i = 0; i < newSwipes.length; i += 500) {
    err(
      await c.from("user_swipes").insert(
        newSwipes.slice(i, i + 500).map((x) => ({
          user_id: uid,
          offering_key: x.key,
          menu_item_id: x.itemId,
          restaurant_id: x.restaurantId,
          chain_id: x.chainId ?? null,
          category: x.category,
          ingredients: x.ingredients,
          price: x.price ?? null,
          portion_size: x.portion,
          action: x.action,
          created_at: x.at,
        })),
      ),
    );
  }
  const newMeals = s.recentMeals.filter((m) => m.at > since);
  if (newMeals.length) err(await c.from("user_recent_meals").insert(newMeals.map((m) => ({ user_id: uid, restaurant_id: m.restaurantId, chain_id: m.chainId ?? null, name: m.name, eaten_at: m.at }))));
  if (location && location.source === "address") {
    await c.from("user_addresses").delete().eq("user_id", uid).eq("is_default", true);
    err(await c.from("user_addresses").insert({ user_id: uid, label: location.label, lat: location.point.lat, lng: location.point.lng, precision: location.precision, is_default: true }));
  }
  try {
    localStorage.setItem(SYNC_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

/** Merge server state into the device (union; device wins on conflicts). */
export async function pullAll(): Promise<void> {
  const c = sb();
  if (!c) return;
  const { data } = await c.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  const [profile, blocks, dislikes, rejections, swipes, meals] = await Promise.all([
    c.from("profiles").select("settings, filters").eq("id", uid).maybeSingle(),
    c.from("user_blocks").select("*").eq("user_id", uid),
    c.from("user_dislikes").select("*").eq("user_id", uid),
    c.from("user_meal_rejections").select("*").eq("user_id", uid),
    c.from("user_swipes").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(2500),
    c.from("user_recent_meals").select("*").eq("user_id", uid).order("eaten_at", { ascending: false }).limit(200),
  ]);
  setState((s) => {
    const seenSwipe = new Set(s.swipes.map((x) => `${x.key}|${x.at}`));
    const remoteSwipes = (swipes.data ?? [])
      .map((r) => ({
        key: r.offering_key,
        itemId: r.menu_item_id,
        restaurantId: r.restaurant_id,
        chainId: r.chain_id ?? undefined,
        category: r.category,
        ingredients: r.ingredients ?? [],
        price: r.price != null ? Number(r.price) : undefined,
        portion: r.portion_size ?? "regular",
        action: r.action,
        at: new Date(r.created_at).toISOString(),
      }))
      .filter((x) => !seenSwipe.has(`${x.key}|${x.at}`));
    const settings = (profile.data?.settings ?? {}) as Partial<typeof s.profile>;
    return {
      ...s,
      profile: s.profile.onboarded ? s.profile : { ...s.profile, ...settings, location: s.profile.location },
      blocks: [...s.blocks, ...(blocks.data ?? []).filter((b) => !s.blocks.some((x) => x.type === b.target_type && x.id === b.target_id)).map((b) => ({ type: b.target_type, id: b.target_id, name: b.target_name, at: b.created_at }))],
      dislikes: [...s.dislikes, ...(dislikes.data ?? []).filter((d) => !s.dislikes.some((x) => x.type === d.target_type && x.id === d.target_id)).map((d) => ({ type: d.target_type, id: d.target_id, name: d.target_name, reason: d.reason, until: d.expires_at }))],
      rejections: [...s.rejections, ...(rejections.data ?? []).filter((r) => !s.rejections.some((x) => x.itemId === r.menu_item_id)).map((r) => ({ itemId: r.menu_item_id, name: r.item_name, at: r.created_at }))],
      swipes: [...s.swipes, ...remoteSwipes].sort((a, b) => a.at.localeCompare(b.at)).slice(-3000),
      recentMeals: [...s.recentMeals, ...(meals.data ?? []).filter((m) => !s.recentMeals.some((x) => x.restaurantId === m.restaurant_id && x.at === m.eaten_at)).map((m) => ({ restaurantId: m.restaurant_id, chainId: m.chain_id ?? undefined, name: m.name, at: m.eaten_at }))],
    };
  });
}
