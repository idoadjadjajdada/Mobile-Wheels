import { z } from "zod";
import { FOOD_CATEGORIES } from "./types";

const hhmm = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, "Use HH:MM");
const verification = z.enum(["verified", "reported", "estimate", "unknown"]);
const tri = z.enum(["yes", "no", "unknown"]);
const httpsUrl = z.string().url().refine((u) => u.startsWith("https://"), "Must be an https:// URL");

export const hoursSetInput = z.object({
  regular: z.array(z.object({ day: z.number().int().min(0).max(6), open: hhmm, close: hhmm })).max(28),
  special: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        closed: z.boolean().optional(),
        periods: z.array(z.object({ open: hhmm, close: hhmm })).max(4).optional(),
        note: z.string().max(80).optional(),
      }),
    )
    .max(60),
});

export const restaurantInput = z.object({
  name: z.string().min(1).max(200),
  marketId: z.string().min(1).max(40),
  chainId: z.string().max(60).nullable().optional(),
  kind: z.enum(["standard", "ghost_kitchen", "virtual_brand", "delivery_only"]),
  hostRestaurantId: z.string().max(100).nullable().optional(),
  address: z.object({ line1: z.string().max(200).optional(), city: z.string().max(100).optional(), state: z.string().max(40).optional(), postalCode: z.string().max(20).optional() }),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  phone: z.string().max(40).optional(),
  website: httpsUrl.optional().or(z.literal("")),
  cuisine: z.array(z.string().max(40)).max(10),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  pickup: tri,
  status: z.enum(["active", "closed_permanently", "hidden"]),
  hours: z
    .object({
      general: hoursSetInput.optional(),
      delivery: hoursSetInput.optional(),
      pickup: hoursSetInput.optional(),
      kitchenCutoffMinutes: z.number().int().min(0).max(180).optional(),
    })
    .optional(),
  /** Fields to protect from automated refresh. */
  lockedFields: z.array(z.string().max(40)).max(20).optional(),
  markVerified: z.boolean().optional(),
});

const PLATFORM_HOSTS: Record<string, string[]> = {
  doordash: ["doordash.com"],
  ubereats: ["ubereats.com"],
  grubhub: ["grubhub.com", "seamless.com"],
};

export const listingInput = z
  .object({
    platform: z.enum(["doordash", "ubereats", "grubhub", "direct", "other"]),
    platformLabel: z.string().max(60).optional(),
    storeUrl: httpsUrl.optional().or(z.literal("")),
    listingStatus: z.enum(["verified_listed", "reported_listed", "not_listed", "unknown"]),
    offersDelivery: tri,
    offersPickup: tri,
  })
  .refine(
    (l) => !l.storeUrl || !PLATFORM_HOSTS[l.platform] || PLATFORM_HOSTS[l.platform].some((h) => new URL(l.storeUrl!).hostname.endsWith(h)),
    { message: "Store URL doesn't belong to that platform", path: ["storeUrl"] },
  );

const priceInput = z
  .object({
    amount: z.number().min(0).max(500).optional(),
    low: z.number().min(0).max(500).optional(),
    high: z.number().min(0).max(500).optional(),
    status: verification,
    channel: z.enum(["in_store", "direct_online", "doordash", "ubereats", "grubhub"]).optional(),
  })
  .refine((p) => p.status !== "verified" || p.amount != null, { message: "A verified price needs an exact amount" })
  .refine((p) => p.low == null || p.high == null || p.low <= p.high, { message: "Low must be ≤ high" });

export const menuItemInput = z
  .object({
    id: z.string().max(100).optional(),
    chainId: z.string().max(60).optional(),
    restaurantId: z.string().max(100).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(600).optional(),
    category: z.enum(FOOD_CATEGORIES),
    ingredients: z.array(z.string().max(40)).max(30),
    price: priceInput,
    comboPrice: priceInput.optional(),
    isCombo: z.boolean(),
    portion: z.object({ size: z.enum(["snack", "regular", "large", "shareable"]), note: z.string().max(120).optional() }),
    calories: z.number().int().min(0).max(5000).optional(),
    allergens: z.object({ contains: z.array(z.string().max(40)).max(14), verified: z.boolean() }).optional(),
    dietary: z.array(z.string().max(40)).max(8),
    image: z.object({ url: httpsUrl, kind: z.enum(["official", "licensed", "representative"]), attribution: z.string().max(200).optional() }).optional(),
    orderPath: httpsUrl.optional().or(z.literal("")),
    available: z.boolean(),
  })
  .refine((m) => m.chainId || m.restaurantId, { message: "Attach the item to a chain or a restaurant" })
  .refine((m) => !m.dietary.length || m.allergens?.verified, { message: "Dietary claims require verified allergen info" });
