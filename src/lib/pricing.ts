import type { DeliveryQuote, FoodCategory, MenuItem, PortionSize, Price, UserProfile } from "./types";

export const money = (n: number) => `$${n.toFixed(2)}`;
const short = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export interface PriceView {
  text: string;
  status: Price["status"];
  /** Single number for sorting/budgets: exact amount, else the top of the estimate range. */
  budgetValue?: number;
  /** Midpoint, for value math. */
  typical?: number;
  badge: "Verified" | "Est." | "Listed" | "Unknown";
}

export function viewPrice(p?: Price): PriceView {
  if (!p || p.status === "unknown" || (p.amount == null && p.low == null)) {
    return { text: "Price not verified", status: "unknown", badge: "Unknown" };
  }
  if (p.amount != null) {
    return {
      text: money(p.amount),
      status: p.status,
      budgetValue: p.amount,
      typical: p.amount,
      badge: p.status === "verified" ? "Verified" : p.status === "estimate" ? "Est." : "Listed",
    };
  }
  const low = p.low!;
  const high = p.high ?? low;
  return {
    text: low === high ? `~${short(low)}` : `${short(low)}–${short(high)}`,
    status: p.status,
    budgetValue: high,
    typical: (low + high) / 2,
    badge: p.status === "verified" ? "Verified" : "Est.",
  };
}

const PORTION_POINTS: Record<PortionSize, number> = { snack: 1, regular: 2, large: 3, shareable: 4 };
/** What a "fair" price looks like for each portion size (Tucson fast-casual baseline). */
const PORTION_FAIR_PRICE: Record<PortionSize, number> = { snack: 4, regular: 8, large: 12, shareable: 18 };
const SIDE_LIKE: FoodCategory[] = ["sides", "drinks", "desserts"];

export function portionPoints(size: PortionSize) {
  return PORTION_POINTS[size];
}

/**
 * Value = how complete and filling the meal is (60%) blended with price
 * efficiency against a fair price for that portion (40%, capped). A $2 snack is
 * efficient but isn't a meal, so it can't outrank a reasonably priced combo on
 * price alone.
 */
export function valueScore(item: MenuItem, profile?: Pick<UserProfile, "portionPreference">): { score: number; label: string } {
  const price = viewPrice(item.price).typical;
  if (price == null) return { score: 0.5, label: "Value unknown" };
  const portion = PORTION_POINTS[item.portion.size] / 4;
  const completeness = item.isCombo ? 1 : SIDE_LIKE.includes(item.category) ? 0.3 : 0.6;
  let meal = portion * 0.55 + completeness * 0.45;
  const pref = profile?.portionPreference;
  if (pref === "hearty" && PORTION_POINTS[item.portion.size] >= 3) meal = Math.min(1, meal + 0.1);
  if (pref === "light" && PORTION_POINTS[item.portion.size] <= 2) meal = Math.min(1, meal + 0.1);
  const efficiency = Math.min(1.3, PORTION_FAIR_PRICE[item.portion.size] / price) / 1.3;
  const score = Math.round((meal * 0.6 + efficiency * 0.4) * 100) / 100;
  const label = score >= 0.8 ? "Great value" : score >= 0.65 ? "Solid value" : score >= 0.5 ? "Fair value" : "Pricey for the portion";
  return { score, label };
}

export interface EstimateLine {
  label: string;
  amount: number;
  kind: "verified" | "estimate" | "user_assumption" | "quote";
  note?: string;
}

export interface OrderEstimate {
  lines: EstimateLine[];
  total: number;
  low: number;
  high: number;
  hasUnknownPrices: boolean;
  disclaimer: string;
}

/**
 * Build an order estimate. Fees only come from a live quote *for the same
 * platform*; otherwise we use the user's own stated assumption, labeled as such.
 * We never splice one platform's menu price with another platform's fees.
 */
export function estimateOrder(input: {
  items: { item: MenuItem; qty: number; combo?: boolean }[];
  taxRate: number;
  tipPercent: number;
  mode: "delivery" | "pickup";
  assumedDeliveryCost: number;
  quote?: DeliveryQuote;
}): OrderEstimate {
  let low = 0;
  let high = 0;
  let allVerified = true;
  let hasUnknownPrices = false;
  for (const { item, qty, combo } of input.items) {
    const p = viewPrice(combo && item.comboPrice ? item.comboPrice : item.price);
    const src = combo && item.comboPrice ? item.comboPrice : item.price;
    if (p.typical == null) {
      hasUnknownPrices = true;
      allVerified = false;
      continue;
    }
    if (p.status !== "verified") allVerified = false;
    low += (src.amount ?? src.low ?? 0) * qty;
    high += (src.amount ?? src.high ?? src.low ?? 0) * qty;
  }
  const mid = (low + high) / 2;
  const lines: EstimateLine[] = [
    {
      label: "Items",
      amount: round(mid),
      kind: allVerified ? "verified" : "estimate",
      note: low !== high ? `${money(low)}–${money(high)}` : undefined,
    },
  ];
  const tax = round(mid * input.taxRate);
  lines.push({ label: `Tax (est. ${(input.taxRate * 100).toFixed(1)}%)`, amount: tax, kind: "estimate" });

  let fees = 0;
  if (input.mode === "delivery") {
    const q = input.quote;
    if (q && q.source !== "none" && (q.deliveryFee != null || q.serviceFee != null)) {
      fees = (q.deliveryFee ?? 0) + (q.serviceFee ?? 0);
      lines.push({ label: "Delivery + service fees", amount: round(fees), kind: "quote", note: `Live quote from ${q.platform}` });
    } else {
      fees = input.assumedDeliveryCost;
      lines.push({
        label: "Delivery + service fees",
        amount: round(fees),
        kind: "user_assumption",
        note: "Your estimate — the provider shows real fees at checkout",
      });
    }
  }
  const tip = input.mode === "delivery" ? round(mid * (input.tipPercent / 100)) : 0;
  if (input.mode === "delivery") lines.push({ label: `Tip (${input.tipPercent}%)`, amount: tip, kind: "user_assumption" });

  const extras = tax + fees + tip;
  const total = round(mid + extras);
  return {
    lines,
    total,
    low: round(low * (1 + input.taxRate) + fees + low * (input.mode === "delivery" ? input.tipPercent / 100 : 0)),
    high: round(high * (1 + input.taxRate) + fees + high * (input.mode === "delivery" ? input.tipPercent / 100 : 0)),
    hasUnknownPrices,
    disclaimer:
      "Estimate only. Menu prices vary by location and are often higher on delivery apps. Your provider shows the final total before you pay.",
  };
}

/** Budget check for a single item, optionally including estimated delivery costs. */
export function budgetValueFor(item: MenuItem, opts: { includeDeliveryCosts: boolean; taxRate: number; tipPercent: number; assumedDeliveryCost: number }) {
  const v = viewPrice(item.price).budgetValue;
  if (v == null) return undefined;
  if (!opts.includeDeliveryCosts) return v;
  return round(v * (1 + opts.taxRate + opts.tipPercent / 100) + opts.assumedDeliveryCost);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const BUDGET_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $10", max: 10 },
  { label: "$10–15", min: 10, max: 15 },
  { label: "$15–20", min: 15, max: 20 },
  { label: "$20–30", min: 20, max: 30 },
  { label: "$30+", min: 30 },
];
