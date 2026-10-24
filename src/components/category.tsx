import {
  Beef,
  Coffee,
  Croissant,
  CupSoda,
  Drumstick,
  EggFried,
  Fish,
  Flame,
  Hamburger,
  IceCreamCone,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { FoodCategory } from "@/lib/types";

export const CATEGORY_META: Record<FoodCategory, { label: string; icon: LucideIcon; from: string; to: string; glow: string }> = {
  burgers: { label: "Burgers", icon: Hamburger, from: "#3a1408", to: "#120806", glow: "#ff7a2f" },
  chicken: { label: "Chicken", icon: Drumstick, from: "#3b2106", to: "#130b05", glow: "#ffb547" },
  pizza: { label: "Pizza", icon: Pizza, from: "#3d0d0d", to: "#140606", glow: "#ff4d3d" },
  sandwiches: { label: "Sandwiches", icon: Sandwich, from: "#2f2410", to: "#110d07", glow: "#e6b25c" },
  tacos: { label: "Tacos", icon: Flame, from: "#3a1a05", to: "#120905", glow: "#ff9a1f" },
  mexican: { label: "Mexican", icon: Flame, from: "#2e1a0a", to: "#100905", glow: "#ffa64d" },
  breakfast: { label: "Breakfast", icon: EggFried, from: "#33280b", to: "#120e05", glow: "#ffd25c" },
  salads: { label: "Salads", icon: Salad, from: "#0f2a17", to: "#07110a", glow: "#7fd8a5" },
  bowls: { label: "Bowls", icon: Soup, from: "#2a1f12", to: "#0f0b07", glow: "#f0a868" },
  asian: { label: "Asian", icon: Soup, from: "#360f12", to: "#120607", glow: "#ff5a5f" },
  seafood: { label: "Seafood", icon: Fish, from: "#0d2230", to: "#060d12", glow: "#7ab8ff" },
  "hot dogs": { label: "Hot dogs", icon: Beef, from: "#3a1308", to: "#120706", glow: "#ff6a3d" },
  sides: { label: "Sides", icon: Croissant, from: "#33260c", to: "#120d06", glow: "#ffc861" },
  desserts: { label: "Desserts", icon: IceCreamCone, from: "#32122a", to: "#11060e", glow: "#ff7ac8" },
  drinks: { label: "Drinks", icon: CupSoda, from: "#0f2633", to: "#060f14", glow: "#5cd0ff" },
};

export const FallbackIcon = UtensilsCrossed;
export const CoffeeIcon = Coffee;
