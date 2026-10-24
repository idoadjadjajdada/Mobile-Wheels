import { describe, expect, it } from "vitest";
import { CATALOG_ITEMS } from "@/lib/catalog/menu";
import { estimateOrder, valueScore, viewPrice } from "@/lib/pricing";

const item = (id: string) => CATALOG_ITEMS.find((i) => i.id === id)!;

describe("viewPrice", () => {
  it("labels estimates and unknowns honestly", () => {
    expect(viewPrice(item("mcd-big-mac").price)).toMatchObject({ text: "$5.29–$6.99", badge: "Est.", budgetValue: 6.99 });
    expect(viewPrice(undefined)).toMatchObject({ text: "Price not verified", badge: "Unknown" });
    expect(viewPrice({ amount: 7.49, currency: "USD", status: "verified", source: "manual" })).toMatchObject({ text: "$7.49", badge: "Verified" });
  });
});

describe("valueScore", () => {
  it("does not equate cheap with good value", () => {
    const tacos = valueScore(item("jib-tacos")); // ~$2.60 snack
    const box = valueScore(item("cane-box")); // ~$12.70 complete combo
    expect(box.score).toBeGreaterThan(tacos.score);
  });
  it("is unknown without a price", () => {
    expect(valueScore({ ...item("mcd-big-mac"), price: { currency: "USD", status: "unknown", source: "catalog" } }).label).toBe("Value unknown");
  });
});

describe("estimateOrder", () => {
  it("labels user-assumed fees instead of inventing platform fees", () => {
    const e = estimateOrder({ items: [{ item: item("mcd-big-mac"), qty: 1 }], taxRate: 0.087, tipPercent: 18, mode: "delivery", assumedDeliveryCost: 6 });
    const fees = e.lines.find((l) => l.label.startsWith("Delivery"))!;
    expect(fees.kind).toBe("user_assumption");
    expect(e.lines[0].kind).toBe("estimate");
    expect(e.total).toBeCloseTo(6.14 + 0.53 + 6 + 1.11, 1);
  });
  it("uses a live quote only when one exists", () => {
    const e = estimateOrder({
      items: [{ item: item("mcd-big-mac"), qty: 2 }],
      taxRate: 0.087,
      tipPercent: 15,
      mode: "delivery",
      assumedDeliveryCost: 6,
      quote: { platform: "doordash", coverage: "in_area", live: "accepting", deliveryFee: 2.99, serviceFee: 1.5, source: "manual" },
    });
    expect(e.lines.find((l) => l.label.startsWith("Delivery"))?.kind).toBe("quote");
  });
  it("skips fees and tip for pickup", () => {
    const e = estimateOrder({ items: [{ item: item("mcd-big-mac"), qty: 1 }], taxRate: 0.087, tipPercent: 18, mode: "pickup", assumedDeliveryCost: 6 });
    expect(e.lines.map((l) => l.label)).toEqual(["Items", "Tax (est. 8.7%)"]);
  });
});
