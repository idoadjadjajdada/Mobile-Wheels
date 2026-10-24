import { DEFAULT_WEIGHTS } from "./ranking";
import type { Filters, PreferenceState, UserProfile } from "./types";

export const DEFAULT_PROFILE: UserProfile = {
  onboarded: false,
  mode: "both",
  tastes: {},
  dietary: [],
  allergens: [],
  portionPreference: "any",
  tipPercent: 18,
  assumedDeliveryCost: 6,
  weights: DEFAULT_WEIGHTS,
  demoMode: false,
};

export const DEFAULT_FILTERS: Filters = {
  categories: [],
  ingredients: [],
  chains: [],
  platforms: [],
  budget: { includeDeliveryCosts: false },
  openNow: false,
  deliveryNow: false,
  laterTonight: false,
  dealsOnly: false,
  dietary: [],
  visited: "any",
  newOnly: false,
  includeClosed: false,
  includeUnknownPrices: true,
  includeUnverifiedAllergens: false,
};

export function emptyState(): PreferenceState {
  return {
    profile: structuredClone(DEFAULT_PROFILE),
    filters: structuredClone(DEFAULT_FILTERS),
    swipes: [],
    blocks: [],
    dislikes: [],
    rejections: [],
    recentMeals: [],
  };
}

export const ALLERGENS = ["peanuts", "tree nuts", "milk", "eggs", "wheat", "soy", "fish", "shellfish", "sesame"];
export const DIETARY = ["vegetarian", "vegan", "gluten-free", "halal", "kosher"];
