import type { Chain, MenuItem } from "../../types";
import { providerFetch, TTLCache } from "../http";
import type { MenuProvider, ProviderInfo } from "../types";

/**
 * Spoonacular Menu Items: ~115k chain items with nutrition. No prices, no
 * locations — so it only ever *enriches nutrition* on items we already have.
 */
const cache = new TTLCache<number | null>(7 * 24 * 3_600_000, 2000);

export class SpoonacularMenuProvider implements MenuProvider {
  private key = process.env.SPOONACULAR_API_KEY;

  info(): ProviderInfo {
    return {
      id: "spoonacular",
      name: "Spoonacular Menu Items",
      kinds: ["menu"],
      requires: ["SPOONACULAR_API_KEY"],
      configured: !!this.key,
      storable: true,
      licensing: "Commercial API; attribution per plan. Nutrition only (no prices/locations).",
      cost: "Free 150 points/day; paid $29–$149/mo.",
      docsUrl: "https://spoonacular.com/food-api/docs#Search-Menu-Items",
    };
  }

  async enrichNutrition(item: MenuItem, chain?: Chain): Promise<MenuItem> {
    if (!this.key || item.nutrition?.calories) return item;
    const query = `${chain?.name ?? ""} ${item.name}`.trim();
    const calories = await cache.wrap(query.toLowerCase(), async () => {
      const params = new URLSearchParams({ query, number: "1", apiKey: this.key! });
      const res = await providerFetch(`https://api.spoonacular.com/food/menuItems/search?${params}`, {
        provider: "spoonacular",
        rate: { key: "spoonacular", perSec: 1 },
      });
      const json = (await res.json()) as { menuItems?: { id: number; restaurantChain: string; title: string }[] };
      const hit = json.menuItems?.[0];
      if (!hit || (chain && !hit.restaurantChain.toLowerCase().includes(chain.name.toLowerCase().split(" ")[0]))) return null;
      const detail = await providerFetch(`https://api.spoonacular.com/food/menuItems/${hit.id}?apiKey=${this.key}`, {
        provider: "spoonacular",
        rate: { key: "spoonacular", perSec: 1 },
      });
      const d = (await detail.json()) as { nutrition?: { calories?: number } };
      return d.nutrition?.calories ?? null;
    });
    if (calories == null) return item;
    return {
      ...item,
      nutrition: { calories, provenance: { source: "spoonacular", verification: "reported", fetchedAt: new Date().toISOString(), attribution: "spoonacular" } },
    };
  }
}
