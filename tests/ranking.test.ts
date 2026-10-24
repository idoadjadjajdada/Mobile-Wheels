import { describe, expect, it } from "vitest";
import { CATALOG_ITEMS } from "@/lib/catalog/menu";
import { CHAIN_BY_ID } from "@/lib/catalog/chains";
import { MARKETS } from "@/lib/catalog/markets";
import { emptyState } from "@/lib/defaults";
import { valueScore } from "@/lib/pricing";
import { buildTasteModel, diversify, exclusionFor, isKnownPickupOnly, scoreOffering } from "@/lib/ranking";
import type { ListingView, MenuItem, Offering, PreferenceState, Restaurant, SwipeEvent } from "@/lib/types";

const now = new Date("2026-10-24T19:00:00-07:00");
const market = MARKETS[0];

function restaurant(id: string, chainId?: string): Restaurant {
  return {
    id,
    marketId: "tucson",
    chainId,
    name: chainId ? CHAIN_BY_ID.get(chainId)!.name : id,
    kind: "standard",
    address: {},
    location: { lat: 32.22, lng: -110.97 },
    cuisine: [],
    hours: {},
    pickup: "unknown",
    externalIds: {},
    provenance: { source: "osm", verification: "reported" },
    status: "active",
    isDemo: false,
    updatedAt: now.toISOString(),
  };
}

function offering(itemId: string, rid = `r-${itemId}`, extra: Partial<Offering> = {}): Offering {
  const item = CATALOG_ITEMS.find((i) => i.id === itemId)!;
  const r = restaurant(rid, item.chainId);
  return {
    key: `${r.id}:${item.id}`,
    item,
    restaurant: r,
    chain: item.chainId ? CHAIN_BY_ID.get(item.chainId) : undefined,
    distanceKm: 2,
    hours: { state: "open", label: "Open", minutesUntilClose: 180 },
    listings: [],
    promotions: [],
    value: valueScore(item),
    score: 0,
    reasons: [],
    ...extra,
  };
}

function swipe(o: Offering, action: SwipeEvent["action"], daysAgo = 1): SwipeEvent {
  return {
    key: o.key,
    itemId: o.item.id,
    restaurantId: o.restaurant.id,
    chainId: o.restaurant.chainId,
    category: o.item.category,
    ingredients: o.item.ingredients,
    price: ((o.item.price.low ?? 0) + (o.item.price.high ?? 0)) / 2,
    portion: o.item.portion.size,
    action,
    at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

const ctx = (state: PreferenceState) => ({ state, market, now, liveDeliveryVerification: false });

describe("product rules", () => {
  it("never shows blocked restaurants or chains", () => {
    const s = emptyState();
    const o = offering("mcd-big-mac");
    s.blocks.push({ type: "chain", id: "mcdonalds", name: "McDonald's", at: now.toISOString() });
    expect(exclusionFor(o, ctx(s))?.reason).toBe("blocked");
  });

  it("treats block, temporary dislike and meal rejection separately", () => {
    const o = offering("mcd-big-mac");
    const tonight = emptyState();
    tonight.dislikes.push({ type: "category", id: "burgers", name: "Burgers", reason: "not_tonight", until: new Date(now.getTime() + 3_600_000).toISOString() });
    expect(exclusionFor(o, ctx(tonight))?.reason).toBe("disliked");
    tonight.dislikes[0].until = new Date(now.getTime() - 1000).toISOString();
    expect(exclusionFor(o, ctx(tonight))).toBeNull(); // expired

    const meal = emptyState();
    meal.rejections.push({ itemId: "mcd-big-mac", name: "Big Mac", at: now.toISOString() });
    expect(exclusionFor(o, ctx(meal))?.reason).toBe("rejected_meal");
    expect(exclusionFor(offering("mcd-qpc"), ctx(meal))).toBeNull(); // other items at the same chain still show
  });

  it("does not repeat passed items during the cooldown", () => {
    const s = emptyState();
    const o = offering("mcd-big-mac");
    s.swipes.push(swipe(o, "pass", 2));
    expect(exclusionFor(o, ctx(s))?.reason).toBe("already_swiped");
    s.swipes = [swipe(o, "pass", 20)];
    expect(exclusionFor(o, ctx(s))).toBeNull();
  });

  it("keeps closed restaurants out of the feed unless enabled", () => {
    const s = emptyState();
    const o = offering("mcd-big-mac", "r1", { hours: { state: "closed", label: "Closed" } });
    expect(exclusionFor(o, ctx(s))?.reason).toBe("closed");
    s.filters.includeClosed = true;
    expect(exclusionFor(o, ctx(s))).toBeNull();
  });

  it("hides known pickup-only places in delivery mode, but not unknowns", () => {
    const s = emptyState();
    s.profile.mode = "delivery";
    const directNo: ListingView = {
      id: "l1", restaurantId: "r1", platform: "direct", listingStatus: "unknown", offersDelivery: "no", offersPickup: "yes",
      provenance: { source: "osm", verification: "reported" }, synthetic: false, urlKind: "none", capabilities: { addressCoverage: false, liveQuote: false },
    };
    const pickupOnly = offering("mcd-big-mac", "r1", { listings: [directNo] });
    expect(isKnownPickupOnly(pickupOnly)).toBe(true);
    expect(exclusionFor(pickupOnly, ctx(s))?.reason).toBe("pickup_only");
    expect(exclusionFor(offering("mcd-big-mac", "r2"), ctx(s))).toBeNull();
    const listed = offering("mcd-big-mac", "r3", { listings: [directNo, { ...directNo, id: "l2", platform: "doordash", listingStatus: "verified_listed" }] });
    expect(isKnownPickupOnly(listed)).toBe(false);
  });

  it("'accepting delivery now' never passes without a live provider", () => {
    const s = emptyState();
    s.filters.deliveryNow = true;
    expect(exclusionFor(offering("mcd-big-mac"), ctx(s))?.reason).toBe("filter");
  });

  it("excludes items with unverified allergen info when the user has allergies", () => {
    const s = emptyState();
    s.profile.allergens = ["peanuts"];
    expect(exclusionFor(offering("mcd-big-mac"), ctx(s))?.reason).toBe("filter");
    s.filters.includeUnverifiedAllergens = true;
    expect(exclusionFor(offering("mcd-big-mac"), ctx(s))).toBeNull();
  });

  it("applies budget including estimated delivery costs", () => {
    const s = emptyState();
    s.filters.budget = { max: 10, includeDeliveryCosts: false };
    expect(exclusionFor(offering("mcd-big-mac"), ctx(s))).toBeNull(); // $6.99 top of range
    s.filters.budget.includeDeliveryCosts = true;
    s.profile.mode = "delivery";
    expect(exclusionFor(offering("mcd-big-mac"), ctx(s))?.reason).toBe("filter"); // + fees/tax/tip > $10
  });
});

describe("taste learning", () => {
  it("lowers expensive items in a category the user keeps passing on", () => {
    const s = emptyState();
    const cheapTenders = offering("cfa-nuggets-8");
    const pricey = [offering("pop-tenders-5", "p1"), offering("cane-box", "p2"), offering("ws-boneless-10", "p3")];
    s.swipes = [swipe(cheapTenders, "like"), swipe(offering("mcd-nuggets-10"), "like"), ...pricey.map((o) => swipe(o, "pass"))];
    const model = buildTasteModel(s.swipes, now);
    const candidate = offering("cane-caniac", "p4"); // ~$19 chicken
    const r = scoreOffering(candidate, s, model, now);
    expect(r.reasons.some((x) => x.includes("pricier chicken"))).toBe(true);
    const cheap = scoreOffering(offering("cfa-sandwich", "p5"), s, model, now);
    expect(cheap.score).toBeGreaterThan(r.score);
  });

  it("recommends more substantial burgers to double-cheeseburger fans", () => {
    const s = emptyState();
    s.swipes = ["mcd-dqpc", "wen-baconator", "bk-bacon-king", "wen-daves-double"].map((id, i) => swipe(offering(id, `x${i}`), "like"));
    const model = buildTasteModel(s.swipes, now);
    const big = scoreOffering(offering("fg-bacon-cheeseburger", "y1"), s, model, now);
    const small = scoreOffering(offering("ino-cheeseburger", "y2"), s, model, now);
    expect(big.score).toBeGreaterThan(small.score);
  });

  it("temporarily deprioritizes a restaurant the user ate at yesterday", () => {
    const s = emptyState();
    const o = offering("mcd-big-mac", "r1");
    const base = scoreOffering(o, s, buildTasteModel([], now), now).score;
    s.recentMeals.push({ restaurantId: "other-branch", chainId: "mcdonalds", name: "McDonald's", at: new Date(now.getTime() - 20 * 3_600_000).toISOString() });
    const after = scoreOffering(o, s, buildTasteModel([], now), now);
    expect(after.score).toBeLessThan(base);
    expect(after.reasons.join(" ")).toMatch(/yesterday/);
  });

  it("explains recommendations", () => {
    const s = emptyState();
    s.profile.tastes.tacos = 2;
    const r = scoreOffering(offering("tb-crunchwrap"), s, buildTasteModel([], now), now);
    expect(r.reasons).toContain("You said you love tacos");
  });
});

describe("diversify", () => {
  it("avoids back-to-back cards from the same chain", () => {
    const deck = [offering("mcd-big-mac", "m1"), offering("mcd-qpc", "m1"), offering("tb-crunchwrap", "t1"), offering("wen-baconator", "w1")];
    const out = diversify(deck);
    expect(out[0].restaurant.chainId).not.toBe(out[1].restaurant.chainId);
  });
});

// keep type import used
export type _M = MenuItem;
