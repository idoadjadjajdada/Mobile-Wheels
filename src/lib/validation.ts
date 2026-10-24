import { z } from "zod";
import { DEFAULT_FILTERS, DEFAULT_PROFILE } from "./defaults";
import { FOOD_CATEGORIES } from "./types";

const iso = z.string().max(40);
const id = z.string().min(1).max(200);
const category = z.enum(FOOD_CATEGORIES);
const portion = z.enum(["snack", "regular", "large", "shareable"]);
const platform = z.enum(["doordash", "ubereats", "grubhub", "direct", "other"]);

export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const weights = z.object({
  taste: z.number().min(0).max(3),
  price: z.number().min(0).max(3),
  distance: z.number().min(0).max(3),
  value: z.number().min(0).max(3),
  variety: z.number().min(0).max(3),
  openness: z.number().min(0).max(3),
});

export const profileSchema = z.object({
  onboarded: z.boolean(),
  displayName: z.string().max(60).optional(),
  location: z
    .object({ label: z.string().max(300), point: latLng, precision: z.enum(["exact", "approximate"]), source: z.enum(["geolocation", "address"]) })
    .optional(),
  mode: z.enum(["delivery", "pickup", "both"]),
  tastes: z.partialRecord(category, z.number().min(-2).max(2)),
  dietary: z.array(z.string().max(40)).max(20),
  allergens: z.array(z.string().max(40)).max(20),
  portionPreference: z.enum(["light", "regular", "hearty", "any"]),
  budgetMax: z.number().min(0).max(500).optional(),
  tipPercent: z.number().min(0).max(50),
  assumedDeliveryCost: z.number().min(0).max(50),
  weights,
  demoMode: z.boolean(),
});

export const filtersSchema = z.object({
  categories: z.array(category).max(20),
  ingredients: z.array(z.string().max(40)).max(20),
  chains: z.array(id).max(50),
  platforms: z.array(platform).max(5),
  budget: z.object({ max: z.number().min(0).max(500).optional(), min: z.number().min(0).max(500).optional(), includeDeliveryCosts: z.boolean() }),
  maxDistanceKm: z.number().min(0.5).max(50).optional(),
  minRating: z.number().min(0).max(5).optional(),
  portion: z.array(portion).max(4).optional(),
  openNow: z.boolean(),
  deliveryNow: z.boolean(),
  openAtLeastMinutes: z.number().min(0).max(600).optional(),
  laterTonight: z.boolean(),
  dealsOnly: z.boolean(),
  dietary: z.array(z.string().max(40)).max(10),
  visited: z.enum(["any", "only", "exclude"]),
  newOnly: z.boolean(),
  includeClosed: z.boolean(),
  includeUnknownPrices: z.boolean(),
  includeUnverifiedAllergens: z.boolean(),
});

export const stateSchema = z.object({
  profile: profileSchema.catch(DEFAULT_PROFILE),
  filters: filtersSchema.catch(DEFAULT_FILTERS),
  swipes: z
    .array(
      z.object({
        key: id,
        itemId: id,
        restaurantId: id,
        chainId: z.string().max(100).optional(),
        category,
        ingredients: z.array(z.string().max(60)).max(30),
        price: z.number().optional(),
        portion,
        action: z.enum(["like", "pass", "save"]),
        at: iso,
      }),
    )
    .max(3000),
  blocks: z.array(z.object({ type: z.enum(["restaurant", "chain"]), id, name: z.string().max(200), at: iso })).max(500),
  dislikes: z
    .array(z.object({ type: z.enum(["restaurant", "chain", "category"]), id, name: z.string().max(200), reason: z.enum(["not_tonight", "tired_of"]), until: iso }))
    .max(500),
  rejections: z.array(z.object({ itemId: id, name: z.string().max(200), at: iso })).max(2000),
  recentMeals: z.array(z.object({ restaurantId: id, chainId: z.string().max(100).optional(), name: z.string().max(200), at: iso })).max(500),
});

export const deckRequest = z.object({ point: latLng, state: stateSchema, limit: z.number().int().min(1).max(100).optional() });
export const keysRequest = z.object({ keys: z.array(id).max(100), point: latLng.optional(), state: stateSchema });
