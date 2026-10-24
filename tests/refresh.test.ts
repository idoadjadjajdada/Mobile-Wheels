import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MARKETS } from "@/lib/catalog/markets";
import { LocalRepository } from "@/lib/db/local";
import { parseOverpass } from "@/lib/providers/discovery/osm";
import type { DiscoveryProvider } from "@/lib/providers/types";
import { refreshMarket } from "@/lib/refresh";

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/overpass-sample.json"), "utf8"));
const market = MARKETS[0];
const now = new Date("2026-10-24T12:00:00-07:00");

function fakeProvider(json: unknown): DiscoveryProvider {
  return {
    info: () => ({ id: "osm", name: "fixture", kinds: ["discovery"], requires: [], configured: true, storable: true, licensing: "", cost: "", docsUrl: "" }),
    discover: async () => parseOverpass(json as never),
  };
}

let repo: LocalRepository;

beforeEach(() => {
  process.env.CRAVE_LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "crave-")), "db.json");
  (globalThis as { __craveLocal?: unknown }).__craveLocal = undefined;
  repo = new LocalRepository();
});

describe("parseOverpass", () => {
  it("skips unnamed and disused places", () => {
    const places = parseOverpass(fixture);
    expect(places.map((p) => p.name)).not.toContain("Closed Place");
    expect(places).toHaveLength(6);
    expect(places.find((p) => p.name === "Test Independent Cafe")?.cuisine).toEqual(["mexican", "breakfast"]);
  });
});

describe("refreshMarket", () => {
  it("ingests, matches chains, dedupes and links virtual brands", async () => {
    const res = await refreshMarket(repo, market, fakeProvider(fixture), { now });
    expect(res.status).toBe("succeeded");
    expect(res.stats).toMatchObject({ discovered: 6, created: 5, merged: 1, virtualLinked: 1 });
    const { rows } = await repo.queryRestaurants({ limit: 100 });
    const mcd = rows.find((r) => r.chainId === "mcdonalds")!;
    expect(mcd.hours.general?.regular).toHaveLength(7);
    expect(mcd.hours.general?.provenance.attribution).toContain("OpenStreetMap");
    expect(rows.find((r) => r.name === "Taco Bell Cantina")?.chainId).toBe("taco-bell");
    const beast = rows.find((r) => r.name === "MrBeast Burger")!;
    expect(beast.kind).toBe("virtual_brand");
    expect(beast.hostRestaurantId).toBe(mcd.id);
    // OSM delivery=no → reported direct listing, used to identify pickup-only.
    const cafe = rows.find((r) => r.name === "Test Independent Cafe")!;
    expect((await repo.listingsFor([cafe.id])).get(cafe.id)?.[0]).toMatchObject({ platform: "direct", offersDelivery: "no" });
    // eegee's has no wikidata in our catalog → suggestion logged for admin review.
    expect((await repo.listChanges()).some((c) => c.entityType === "chain" && c.entityId === "eegees")).toBe(true);
  });

  it("is idempotent and detects changes, respecting locked fields", async () => {
    await refreshMarket(repo, market, fakeProvider(fixture), { now });
    const again = await refreshMarket(repo, market, fakeProvider(fixture), { now });
    expect(again.stats.created).toBe(0);
    expect(again.stats.updated).toBe(0);

    const { rows } = await repo.queryRestaurants({ q: "taco", limit: 5 });
    const tb = rows[0];
    await repo.upsertRestaurant({ ...tb, phone: "520-555-9999", lockedFields: ["phone"] });

    const changed = structuredClone(fixture);
    const el = changed.elements.find((e: { id: number }) => e.id === 1002);
    el.tags.opening_hours = "Mo-Su 10:00-23:00";
    el.tags.phone = "+1 520 555 0000";
    const res = await refreshMarket(repo, market, fakeProvider(changed), { now });
    expect(res.stats.updated).toBe(1);
    expect(res.stats.skippedLocked).toBe(1);
    const after = await repo.getRestaurant(tb.id);
    expect(after?.phone).toBe("520-555-9999");
    expect(after?.hours.general?.regular[0]).toMatchObject({ open: "10:00", close: "23:00" });
    const log = await repo.listChanges();
    expect(log.some((c) => c.entityId === tb.id && c.field === "hours" && c.changeType === "updated")).toBe(true);
    expect(log.some((c) => c.entityId === tb.id && c.field === "phone" && c.changeType === "skipped_locked")).toBe(true);
  });

  it("marks vanished places stale instead of deleting them", async () => {
    await refreshMarket(repo, market, fakeProvider(fixture), { now });
    const fewer = { elements: fixture.elements.filter((e: { id: number }) => e.id !== 1004) };
    const res = await refreshMarket(repo, market, fakeProvider(fewer), { now });
    expect(res.stats.markedStale).toBe(1);
    const { rows } = await repo.queryRestaurants({ q: "independent" });
    expect(rows[0].refreshStatus).toBe("stale");
    expect(rows[0].status).toBe("active");
  });

  it("records failures on the run", async () => {
    const broken: DiscoveryProvider = { ...fakeProvider(fixture), discover: async () => { throw new Error("overpass 429"); } };
    const res = await refreshMarket(repo, market, broken, { now });
    expect(res.status).toBe("failed");
    expect((await repo.listRuns())[0]).toMatchObject({ status: "failed", error: "overpass 429" });
  });
});
