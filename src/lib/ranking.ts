import { availableLaterTonight } from "./hours";
import { budgetValueFor, portionPoints, viewPrice } from "./pricing";
import type { FoodCategory, Market, Offering, PreferenceState, RankingWeights, SwipeEvent } from "./types";

/**
 * Transparent, adjustable recommender. No ML: a weighted sum of named factors,
 * each of which produces a human-readable reason. Users can change the weights
 * in their profile and see why any card was recommended.
 */

export const DEFAULT_WEIGHTS: RankingWeights = { taste: 1, price: 0.6, distance: 0.5, value: 0.5, variety: 0.7, openness: 0.6 };

const DAY = 86_400_000;
export const PASS_COOLDOWN_DAYS = 14;

// ---------------------------------------------------------------------------
// Hard filters: product rules first, then user filters.
// ---------------------------------------------------------------------------

export type ExclusionReason =
  | "blocked"
  | "disliked"
  | "rejected_meal"
  | "already_swiped"
  | "pickup_only"
  | "no_pickup"
  | "closed"
  | "filter";

export interface FilterContext {
  state: PreferenceState;
  market: Market;
  now: Date;
  /** Live delivery adapters available? (none today) */
  liveDeliveryVerification: boolean;
}

export function exclusionFor(o: Offering, ctx: FilterContext): { reason: ExclusionReason; detail: string } | null {
  const { state, now } = ctx;
  const { profile, filters } = state;
  const r = o.restaurant;
  const t = now.getTime();

  // Permanent blocks.
  if (state.blocks.some((b) => (b.type === "restaurant" && b.id === r.id) || (b.type === "chain" && b.id === r.chainId))) {
    return { reason: "blocked", detail: "You blocked this restaurant" };
  }
  // Temporary dislikes.
  const dislike = state.dislikes.find(
    (d) =>
      Date.parse(d.until) > t &&
      ((d.type === "restaurant" && d.id === r.id) || (d.type === "chain" && d.id === r.chainId) || (d.type === "category" && d.id === o.item.category)),
  );
  if (dislike) return { reason: "disliked", detail: `Hidden until ${new Date(dislike.until).toLocaleDateString()}` };
  // Individual meal rejections.
  if (state.rejections.some((m) => m.itemId === o.item.id)) return { reason: "rejected_meal", detail: "You said never show this meal" };
  // Don't repeat: liked/saved cards live in the shortlist; passes cool down.
  const last = lastSwipe(state.swipes, o.key);
  if (last && (last.action !== "pass" || t - Date.parse(last.at) < PASS_COOLDOWN_DAYS * DAY)) {
    return { reason: "already_swiped", detail: "Already swiped" };
  }

  // Delivery / pickup mode.
  if (profile.mode === "delivery" && isKnownPickupOnly(o)) return { reason: "pickup_only", detail: "Pickup only" };
  if (profile.mode === "pickup" && r.pickup === "no") return { reason: "no_pickup", detail: "No pickup" };

  // Closed places stay out of the "available now" feed unless explicitly enabled.
  if (!filters.includeClosed && o.hours.state === "closed") return { reason: "closed", detail: "Closed now" };

  if (!passesUserFilters(o, ctx)) return { reason: "filter", detail: "Filtered out" };
  return null;
}

/**
 * Known pickup-only: the restaurant itself reports no delivery (OSM delivery=no or
 * an admin), or an admin verified it's absent from every delivery platform —
 * and no platform listing says otherwise. Synthetic "unknown" listings (search
 * links we generate) are not evidence either way.
 */
export function isKnownPickupOnly(o: Offering): boolean {
  if (o.restaurant.kind === "delivery_only" || o.restaurant.kind === "virtual_brand") return false;
  const real = o.listings.filter((l) => !l.synthetic);
  const platforms = real.filter((l) => l.platform !== "direct");
  if (platforms.some((l) => l.listingStatus === "verified_listed" || l.listingStatus === "reported_listed")) return false;
  const direct = real.find((l) => l.platform === "direct");
  if (direct?.offersDelivery === "yes") return false;
  if (direct?.offersDelivery === "no") return true;
  const checked = new Set(platforms.filter((l) => l.listingStatus === "not_listed").map((l) => l.platform));
  return ["doordash", "ubereats", "grubhub"].every((p) => checked.has(p as never));
}

export function passesUserFilters(o: Offering, ctx: FilterContext): boolean {
  const { filters: f, profile, recentMeals, swipes } = ctx.state;
  const item = o.item;
  const r = o.restaurant;

  if (f.categories.length && !f.categories.includes(item.category)) return false;
  if (f.ingredients.length) {
    const ing = item.ingredients.map((i) => i.toLowerCase());
    if (!f.ingredients.some((q) => ing.some((i) => i.includes(q.toLowerCase())) || item.name.toLowerCase().includes(q.toLowerCase()))) return false;
  }
  if (f.chains.length && (!r.chainId || !f.chains.includes(r.chainId))) return false;
  if (f.platforms.length) {
    const ok = f.platforms.some((p) =>
      p === "direct"
        ? !!(o.chain?.directOrderUrl || r.website)
        : o.listings.some((l) => l.platform === p && (l.listingStatus === "verified_listed" || l.listingStatus === "reported_listed")),
    );
    if (!ok) return false;
  }
  if (f.budget.max != null || f.budget.min != null) {
    const v = budgetValueFor(item, {
      includeDeliveryCosts: f.budget.includeDeliveryCosts && profile.mode !== "pickup",
      taxRate: ctx.market.taxRate,
      tipPercent: profile.tipPercent,
      assumedDeliveryCost: profile.assumedDeliveryCost,
    });
    if (v == null) {
      if (!f.includeUnknownPrices) return false;
    } else {
      if (f.budget.max != null && v > f.budget.max) return false;
      if (f.budget.min != null && v < f.budget.min) return false;
    }
  }
  if (f.maxDistanceKm != null && o.distanceKm > f.maxDistanceKm) return false;
  if (f.minRating != null && (!r.rating || r.rating.value < f.minRating)) return false;
  if (f.portion?.length && !f.portion.includes(item.portion.size)) return false;
  if (f.openNow && !(o.hours.state === "open" || o.hours.state === "closing_soon")) return false;
  if (f.openAtLeastMinutes != null) {
    if (o.hours.state === "unknown" || o.hours.state === "closed") return false;
    if (o.hours.minutesUntilClose != null && o.hours.minutesUntilClose < f.openAtLeastMinutes) return false;
  }
  if (f.laterTonight && !availableLaterTonight(r.hours.general, ctx.market.timezone, ctx.now)) return false;
  // Accepting delivery *now* needs a live, authorized source. Without one, nothing qualifies — and the UI says why.
  if (f.deliveryNow && !ctx.liveDeliveryVerification) return false;
  if (f.dealsOnly && !o.promotions.length) return false;
  if (f.dietary.length && !f.dietary.every((d) => item.dietary.includes(d))) return false;

  if (profile.allergens.length) {
    const a = item.allergens;
    const verified = a && (a.provenance.verification === "verified" || a.provenance.verification === "reported");
    if (verified) {
      const contains = a!.contains.map((x) => x.toLowerCase());
      if (profile.allergens.some((al) => contains.includes(al.toLowerCase()))) return false;
    } else if (!f.includeUnverifiedAllergens) {
      return false;
    }
  }

  const visited = recentMeals.some((m) => m.restaurantId === r.id) || swipes.some((s) => s.restaurantId === r.id && s.action === "like");
  if (f.visited === "only" && !visited) return false;
  if (f.visited === "exclude" && visited) return false;
  if (f.newOnly && (visited || swipes.some((s) => s.restaurantId === r.id))) return false;
  return true;
}

function lastSwipe(swipes: SwipeEvent[], key: string) {
  for (let i = swipes.length - 1; i >= 0; i--) if (swipes[i].key === key) return swipes[i];
  return undefined;
}

// ---------------------------------------------------------------------------
// Learned signals
// ---------------------------------------------------------------------------

export interface TasteModel {
  category: Map<FoodCategory, { likes: number; passes: number }>;
  chain: Map<string, { likes: number; passes: number }>;
  ingredient: Map<string, number>;
  likedPrices: Map<FoodCategory, number[]>;
  passedPrices: Map<FoodCategory, number[]>;
  likedPortions: Map<FoodCategory, number[]>;
  recentPasses: Map<FoodCategory, number>;
}

export function buildTasteModel(swipes: SwipeEvent[], now: Date): TasteModel {
  const m: TasteModel = {
    category: new Map(),
    chain: new Map(),
    ingredient: new Map(),
    likedPrices: new Map(),
    passedPrices: new Map(),
    likedPortions: new Map(),
    recentPasses: new Map(),
  };
  const t = now.getTime();
  for (const s of swipes) {
    // Older signals fade: half-life of 30 days.
    const w = Math.pow(0.5, (t - Date.parse(s.at)) / (30 * DAY));
    const positive = s.action === "like" || s.action === "save";
    const c = m.category.get(s.category) ?? { likes: 0, passes: 0 };
    if (positive) c.likes += w;
    else c.passes += w;
    m.category.set(s.category, c);
    if (s.chainId) {
      const ch = m.chain.get(s.chainId) ?? { likes: 0, passes: 0 };
      if (positive) ch.likes += w;
      else ch.passes += w;
      m.chain.set(s.chainId, ch);
    }
    for (const ing of s.ingredients) m.ingredient.set(ing, (m.ingredient.get(ing) ?? 0) + (positive ? w : -0.5 * w));
    if (s.price != null) {
      const bucket = positive ? m.likedPrices : m.passedPrices;
      bucket.set(s.category, [...(bucket.get(s.category) ?? []), s.price]);
    }
    if (positive) m.likedPortions.set(s.category, [...(m.likedPortions.get(s.category) ?? []), portionPoints(s.portion)]);
    if (!positive && t - Date.parse(s.at) < DAY) m.recentPasses.set(s.category, (m.recentPasses.get(s.category) ?? 0) + 1);
  }
  return m;
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface Factor {
  key: keyof RankingWeights | "quality";
  value: number; // -1..1, before weighting
  weighted: number;
  reason?: string;
}

export function scoreOffering(o: Offering, state: PreferenceState, model: TasteModel, now: Date): { score: number; factors: Factor[]; reasons: string[] } {
  const w = state.profile.weights;
  const cat = o.item.category;
  const price = viewPrice(o.item.price).typical;
  const factors: Factor[] = [];
  const push = (key: Factor["key"], value: number, weight: number, reason?: string) =>
    factors.push({ key, value: clamp(value), weighted: clamp(value) * weight, reason });

  // --- Taste ---
  const stated = (state.profile.tastes[cat] ?? 0) / 2;
  const c = model.category.get(cat);
  const learned = c ? (c.likes - c.passes) / (c.likes + c.passes + 2) : 0;
  const ingScore =
    o.item.ingredients.reduce((acc, i) => acc + Math.tanh((model.ingredient.get(i) ?? 0) / 3), 0) / Math.max(3, o.item.ingredients.length);
  const ch = o.restaurant.chainId ? model.chain.get(o.restaurant.chainId) : undefined;
  const chainScore = ch ? (ch.likes - ch.passes) / (ch.likes + ch.passes + 2) : 0;
  // "Likes double cheeseburgers" → prefer substantial items in that category.
  const likedPortion = median(model.likedPortions.get(cat) ?? []);
  const portionMatch = likedPortion != null ? (portionPoints(o.item.portion.size) >= likedPortion ? 0.3 : -0.2) : 0;
  const taste = stated * 0.45 + learned * 0.7 + ingScore * 0.4 + chainScore * 0.35 + portionMatch;
  const catName = cat === "hot dogs" ? "hot dogs" : cat;
  push(
    "taste",
    taste,
    w.taste,
    learned > 0.25 && c
      ? `You've liked ${Math.round(c.likes)} ${catName} picks`
      : stated > 0.4
        ? `You said you love ${catName}`
        : chainScore > 0.3
          ? `You often like ${o.chain?.name ?? o.restaurant.name}`
          : portionMatch > 0 && likedPortion != null && likedPortion >= 3
            ? `Hearty ${catName} — your usual move`
            : learned < -0.3
              ? `You've been passing on ${catName}`
              : undefined,
  );

  // --- Price fit ---
  let priceFit = 0;
  let priceReason: string | undefined;
  if (price != null) {
    const budget = state.profile.budgetMax ?? state.filters.budget.max;
    if (budget) {
      priceFit += price <= budget ? 0.4 : -0.6;
      if (price <= budget) priceReason = `Fits your $${budget} budget`;
    }
    const likedMed = median(model.likedPrices.get(cat) ?? []);
    const passed = model.passedPrices.get(cat) ?? [];
    // "Repeatedly rejects expensive chicken tenders" → punish items at/above the prices they pass on.
    const pricierPasses = passed.filter((p) => p <= price * 1.1 && p >= (likedMed ?? 0)).length;
    if (likedMed != null && price > likedMed * 1.25 && pricierPasses >= 2) {
      priceFit -= 0.6;
      priceReason = `Lowered: you pass on pricier ${catName}`;
    } else if (likedMed != null && price <= likedMed * 1.1) {
      priceFit += 0.2;
    }
  }
  push("price", priceFit, w.price, priceReason);

  // --- Distance ---
  const d = o.distanceKm;
  push("distance", 1 - 2 * Math.min(d / 8, 1), w.distance, d < 1.5 && !o.restaurant.locationless ? "Really close by" : undefined);

  // --- Value ---
  push("value", (o.value.score - 0.6) * 2.5, w.value, o.value.score >= 0.8 ? o.value.label : undefined);

  // --- Variety: recently eaten, recently passed category, saturation ---
  let variety = 0;
  let varietyReason: string | undefined;
  const t = now.getTime();
  const ate = state.recentMeals
    .filter((m) => m.restaurantId === o.restaurant.id || (m.chainId && m.chainId === o.restaurant.chainId))
    .map((m) => (t - Date.parse(m.at)) / DAY)
    .sort((a, b) => a - b)[0];
  if (ate != null && ate < 4) {
    variety -= ate < 1.5 ? 1 : ate < 2.5 ? 0.6 : 0.3;
    varietyReason = `Lowered: you ate at ${o.chain?.name ?? o.restaurant.name} ${ate < 1.5 ? "yesterday" : "recently"}`;
  }
  const rp = model.recentPasses.get(cat) ?? 0;
  if (rp >= 3) {
    variety -= Math.min(0.6, rp * 0.12);
    varietyReason ??= `Lowered: lots of ${catName} passes tonight`;
  }
  push("variety", variety, w.variety, varietyReason);

  // --- Openness ---
  const h = o.hours;
  const open =
    h.state === "open"
      ? h.minutesUntilClose == null || h.minutesUntilClose > 90
        ? 0.6
        : 0.3
      : h.state === "closing_soon"
        ? -0.3
        : h.state === "unknown"
          ? -0.2
          : -1;
  push("openness", open, w.openness, h.state === "open" && (h.minutesUntilClose ?? 999) > 120 ? "Open for a while" : undefined);

  // --- Data quality (small nudge for verified info) ---
  push("quality", o.item.price.status === "verified" ? 0.3 : 0, 0.3, o.item.price.status === "verified" ? "Price verified" : undefined);

  const score = factors.reduce((a, f) => a + f.weighted, 0);
  const reasons = factors
    .filter((f) => f.reason && (f.weighted > 0.05 || f.reason.startsWith("Lowered")))
    .sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted))
    .map((f) => f.reason!)
    .slice(0, 4);
  return { score: Math.round(score * 1000) / 1000, factors, reasons };
}

/** Greedy diversity re-rank: avoid the same chain back-to-back and long runs of one category. */
export function diversify(sorted: Offering[]): Offering[] {
  const pool = [...sorted];
  const out: Offering[] = [];
  while (pool.length) {
    const recent = out.slice(-3);
    let idx = pool.findIndex(
      (o) =>
        !recent.some((r) => r.restaurant.chainId && r.restaurant.chainId === o.restaurant.chainId) &&
        !(out.length >= 2 && out.slice(-2).every((r) => r.item.category === o.item.category)) &&
        !recent.some((r) => r.restaurant.id === o.restaurant.id),
    );
    if (idx === -1 || idx > 6) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** "Surprise me": weighted random from the top of the ranked deck. */
export function surprisePick(deck: Offering[], rand = Math.random): Offering | undefined {
  const top = deck.slice(0, 15);
  if (!top.length) return undefined;
  const min = Math.min(...top.map((o) => o.score));
  const weights = top.map((o) => o.score - min + 0.25);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[top.length - 1];
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}
