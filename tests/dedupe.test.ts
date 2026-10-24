import { describe, expect, it } from "vitest";
import { detectKind, matchChain, nameSimilarity, normalizeName, resolvePlace } from "@/lib/dedupe";

describe("normalizeName", () => {
  it("strips punctuation, store numbers and stopwords", () => {
    expect(normalizeName("McDonald's #12345")).toBe("mcdonalds");
    expect(normalizeName("The Habit Burger Grill")).toBe("habit burger");
    expect(normalizeName("Café Poca Cosa")).toBe("cafe poca cosa");
  });
});

describe("matchChain", () => {
  it("prefers brand:wikidata", () => {
    expect(matchChain({ name: "Some Odd Name", brandWikidata: "Q38076" })?.id).toBe("mcdonalds");
  });
  it("matches by name, alias and prefix", () => {
    expect(matchChain({ name: "Taco Bell Cantina" })?.id).toBe("taco-bell");
    expect(matchChain({ name: "Raising Cane's Chicken Fingers" })?.id).toBe("raising-canes");
    expect(matchChain({ name: "In-N-Out Burger" })?.id).toBe("in-n-out");
    expect(matchChain({ name: "Chick-fil-A" })?.id).toBe("chick-fil-a");
  });
  it("does not false-positive on independents", () => {
    expect(matchChain({ name: "Mi Nidito" })).toBeUndefined();
    expect(matchChain({ name: "Subway Sandwich Art Gallery Cafe" })).toBeUndefined();
    expect(matchChain({ name: "Sonic Drive In" })?.id).toBe("sonic");
    expect(matchChain({ name: "Subway 4521" })?.id).toBe("subway");
    expect(matchChain({ name: "The Sonic Boom Bar" })).toBeUndefined();
  });
});

describe("resolvePlace", () => {
  const existing = [
    { id: "a", name: "McDonald's", chainId: "mcdonalds", location: { lat: 32.2301, lng: -110.9501 }, kind: "standard" as const },
    { id: "b", name: "Mi Nidito Cafe", location: { lat: 32.2, lng: -110.97 }, phone: "(520) 555-0100", kind: "standard" as const },
  ];

  it("merges the same chain branch from another source", () => {
    expect(resolvePlace({ name: "McDonald's", chainId: "mcdonalds", location: { lat: 32.23015, lng: -110.95015 }, kind: "standard" }, existing)).toMatchObject({ type: "same", id: "a" });
  });

  it("keeps two branches of a chain separate", () => {
    expect(resolvePlace({ name: "McDonald's", chainId: "mcdonalds", location: { lat: 32.24, lng: -110.95 }, kind: "standard" }, existing).type).toBe("new");
  });

  it("merges independents by name + distance or phone", () => {
    expect(resolvePlace({ name: "Mi Nidito", location: { lat: 32.20003, lng: -110.97003 }, kind: "standard" }, existing)).toMatchObject({ type: "same", id: "b" });
    expect(resolvePlace({ name: "Mi Nidito Restaurant & Cafe", location: { lat: 32.2008, lng: -110.9708 }, phone: "+15205550100", kind: "standard" }, existing)).toMatchObject({ type: "same", id: "b" });
  });

  it("links virtual brands to their host instead of merging", () => {
    expect(detectKind({ name: "MrBeast Burger" })).toBe("virtual_brand");
    expect(resolvePlace({ name: "MrBeast Burger", location: { lat: 32.23011, lng: -110.95011 }, kind: "virtual_brand" }, existing)).toMatchObject({ type: "virtual_of", hostId: "a" });
  });

  it("scores similarity sensibly", () => {
    expect(nameSimilarity("Taco Bell", "Taco Bell Cantina")).toBeGreaterThan(0.85);
    expect(nameSimilarity("Burger King", "Burger Palace")).toBeLessThan(0.6);
  });
});
