import type { DeliveryListing, MenuItem, Restaurant } from "../types";

/**
 * DEMO DATA — entirely fictional restaurants and menus for development and
 * screenshots. Never mixed into live results: the deck only uses this when the
 * user explicitly enables Demo mode, and every screen shows a DEMO banner.
 */

const DEMO_PROV = { source: "demo" as const, verification: "unknown" as const, attribution: "Fictional demo data" };
const everyDay = (open: string, close: string) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }));
const hours = (open: string, close: string) => ({ general: { regular: everyDay(open, close), special: [], provenance: DEMO_PROV } });

function r(id: string, name: string, dLat: number, dLng: number, h: ReturnType<typeof hours>, kind: Restaurant["kind"] = "standard", extra: Partial<Restaurant> = {}): Restaurant {
  return {
    id: `demo-${id}`,
    marketId: "tucson",
    name,
    kind,
    address: { line1: "Demo location (fictional)", city: "Tucson", state: "AZ" },
    location: { lat: 32.2226 + dLat, lng: -110.9747 + dLng },
    cuisine: [],
    hours: h,
    pickup: kind === "standard" ? "yes" : "no",
    externalIds: {},
    provenance: DEMO_PROV,
    status: "active",
    isDemo: true,
    updatedAt: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

export const DEMO_RESTAURANTS: Restaurant[] = [
  r("ember", "Ember & Bun (Demo)", 0.01, 0.005, hours("10:30", "02:00")),
  r("sonoran", "Sonoran Smoke Shack (Demo)", -0.008, 0.012, hours("11:00", "22:00")),
  r("noodle", "Night Noodle Lab (Demo)", 0.015, -0.01, hours("17:00", "03:00")),
  r("pie", "Saguaro Slice Co. (Demo)", -0.02, -0.006, hours("11:00", "23:00")),
  r("wing", "Wingtip Kitchen (Demo)", 0.004, 0.02, hours("00:00", "24:00"), "virtual_brand", { hostRestaurantId: "demo-ember" }),
  r("green", "Green Spoon (Demo)", -0.003, -0.018, hours("08:00", "15:00")),
];

const price = (low: number, high: number) => ({ low, high, currency: "USD" as const, status: "estimate" as const, source: "demo" as const });

function m(id: string, rid: string, name: string, category: MenuItem["category"], p: [number, number], size: MenuItem["portion"]["size"], ingredients: string[], description: string, isCombo = false): MenuItem {
  return {
    id: `demo-${id}`,
    restaurantId: `demo-${rid}`,
    name,
    description,
    category,
    ingredients,
    price: price(...p),
    isCombo,
    portion: { size },
    dietary: [],
    available: true,
    provenance: DEMO_PROV,
  };
}

export const DEMO_ITEMS: MenuItem[] = [
  m("smash", "ember", "Double Smash Stack", "burgers", [9, 11], "large", ["beef", "cheese", "onion", "pickles"], "Two crispy-edged smashed patties, melty cheese, griddled onions."),
  m("hatch", "ember", "Hatch Chile Burger", "burgers", [10, 12], "regular", ["beef", "green chile", "cheese"], "Roasted green chile, pepper jack, toasted brioche."),
  m("emberfries", "ember", "Ember Fries", "sides", [4, 5], "regular", ["potato"], "Double-fried, smoked salt."),
  m("brisket", "sonoran", "Mesquite Brisket Plate", "sandwiches", [16, 19], "large", ["brisket", "bbq", "coleslaw"], "Mesquite-smoked brisket, two sides, white bread.", true),
  m("sonoran-dog", "sonoran", "Sonoran Hot Dog", "hot dogs", [6, 8], "regular", ["hot dog", "bacon", "beans", "tomato", "onion"], "Bacon-wrapped dog, pinto beans, tomato, onion, mustard, mayo, jalapeño salsa."),
  m("carne", "sonoran", "Carne Asada Tacos (3)", "tacos", [11, 13], "regular", ["steak", "salsa", "tortilla"], "Grilled carne asada, guacamole, salsa verde on corn tortillas."),
  m("tonkotsu", "noodle", "Midnight Tonkotsu", "asian", [14, 16], "large", ["pork", "noodles", "egg"], "Rich pork broth, chashu, soft egg, scallion."),
  m("bao", "noodle", "Crispy Chicken Bao (2)", "asian", [8, 10], "snack", ["chicken", "pickles"], "Fried chicken thigh, quick pickles, chili mayo."),
  m("pep", "pie", "Hot Honey Pepperoni (Large)", "pizza", [18, 22], "shareable", ["pepperoni", "mozzarella", "honey"], "Cup-and-char pepperoni, hot honey drizzle."),
  m("marg", "pie", "Margherita Slice", "pizza", [4, 5], "snack", ["mozzarella", "tomato", "basil"], "New York-style slice."),
  m("lemonpep", "wing", "Lemon Pepper Wings (10)", "chicken", [13, 16], "large", ["chicken", "wings"], "Delivery-only virtual brand operating from Ember & Bun's kitchen."),
  m("tenders", "wing", "Nashville Hot Tenders", "chicken", [12, 14], "regular", ["chicken", "tenders", "spicy"], "Three tenders, Nashville hot, pickles, white bread.", true),
  m("bowl", "green", "Harvest Grain Bowl", "bowls", [12, 14], "regular", ["quinoa", "chicken", "avocado"], "Quinoa, roasted chicken, avocado, seasonal veg."),
  m("chilaquiles", "green", "Chilaquiles Verdes", "breakfast", [11, 13], "regular", ["tortilla chips", "egg", "salsa verde"], "Salsa verde, fried egg, crema, cotija."),
];

export const DEMO_LISTINGS: DeliveryListing[] = DEMO_RESTAURANTS.flatMap((x) =>
  x.kind === "standard"
    ? [{ id: `${x.id}-direct`, restaurantId: x.id, platform: "direct" as const, listingStatus: "unknown" as const, offersDelivery: "unknown" as const, offersPickup: "yes" as const, provenance: DEMO_PROV }]
    : [],
);
