import { createRoot } from "react-dom/client";
import { useEffect, type ComponentType } from "react";
import About from "@/app/about/page";
import Compare from "@/app/compare/page";
import Discover from "@/app/discover/page";
import Filters from "@/app/filters/page";
import GroupRoom from "@/app/group/[code]/page";
import GroupHome from "@/app/group/page";
import Item from "@/app/item/[key]/page";
import Likes from "@/app/likes/page";
import Onboarding from "@/app/onboarding/page";
import Order from "@/app/order/[key]/page";
import Home from "@/app/page";
import Profile from "@/app/profile/page";
import Restaurant from "@/app/restaurant/[id]/page";
import { ToastProvider } from "@/components/toast";
import { ensureHydrated } from "@/lib/client/store";
import { PreviewLocation } from "./location-page";
import { PreviewBanner } from "./preview-banner";
import { matchRoute, useHref, type RoutePattern } from "./router";
import "./styles.css";

const PAGES: Record<RoutePattern, ComponentType> = {
  "/": Home,
  "/onboarding": Onboarding,
  "/location": PreviewLocation,
  "/discover": Discover,
  "/filters": Filters,
  "/likes": Likes,
  "/compare": Compare,
  "/profile": Profile,
  "/group": GroupHome,
  "/group/[code]": GroupRoom,
  "/about": About,
  "/item/[key]": Item,
  "/order/[key]": Order,
  "/restaurant/[id]": Restaurant,
};

function App() {
  const href = useHref();
  useEffect(() => ensureHydrated(), []);
  const match = matchRoute(href.split("?")[0]);
  const Page = match ? PAGES[match.pattern] : Discover;
  return (
    <ToastProvider>
      <PreviewBanner />
      <Page key={href} />
    </ToastProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
