import { BadgeCheck, CircleHelp, Clock, Ghost, Store, Truck } from "lucide-react";
import { offeringDistance } from "@/lib/geo";
import { viewPrice } from "@/lib/pricing";
import type { HoursStatus, ListingView, Offering, Price, Restaurant, Verification } from "@/lib/types";

export function PriceTag({ price, size = "md", combo }: { price?: Price; size?: "sm" | "md" | "lg"; combo?: boolean }) {
  const v = viewPrice(price);
  const big = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-sm";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`${big} font-semibold tabular-nums tracking-tight ${v.status === "unknown" ? "text-dust text-base font-medium" : "text-bone"}`}>{v.text}</span>
      {v.badge !== "Unknown" && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            v.badge === "Verified" ? "bg-sage/15 text-sage" : "bg-honey/15 text-honey"
          }`}
          title={v.badge === "Verified" ? "Verified price" : "Estimated typical price — not a quote"}
        >
          {combo ? `${v.badge} combo` : v.badge}
        </span>
      )}
    </span>
  );
}

export function HoursPill({ hours, compact }: { hours: HoursStatus; compact?: boolean }) {
  const color =
    hours.state === "open" ? "text-sage" : hours.state === "closing_soon" ? "text-honey" : hours.state === "closed" ? "text-flame" : "text-dust";
  const dot = hours.state === "open" ? "bg-sage" : hours.state === "closing_soon" ? "bg-honey" : hours.state === "closed" ? "bg-flame" : "bg-mute";
  const text = compact ? hours.label.split(" · ").slice(0, 2).join(" · ") : hours.label;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${hours.state === "open" ? "shadow-[0_0_8px] shadow-sage" : ""}`} />
      {text}
    </span>
  );
}

export function VerificationNote({ v, at, source }: { v: Verification; at?: string; source?: string }) {
  const label = v === "verified" ? "Verified" : v === "reported" ? "Reported" : v === "estimate" ? "Estimate" : "Unverified";
  const date = at ? new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : undefined;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-mute">
      {v === "verified" ? <BadgeCheck className="h-3 w-3 text-sage" /> : <CircleHelp className="h-3 w-3" />}
      {label}
      {source ? ` · ${source}` : ""}
      {date ? ` · ${date}` : ""}
    </span>
  );
}

const PLATFORM_STYLE: Record<string, string> = {
  doordash: "text-[#ff6b4a]",
  ubereats: "text-[#5fd38a]",
  grubhub: "text-[#ff8a3d]",
  direct: "text-bone",
};

/** Platform presence chips. "Listed" ≠ "delivers to you" ≠ "accepting now". */
export function PlatformChips({ listings, max = 4 }: { listings: ListingView[]; max?: number }) {
  const shown = listings.filter((l) => l.url).slice(0, max);
  if (!shown.length) return <span className="text-xs text-mute">No ordering links yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((l) => (
        <span key={l.platform} className="glass inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
          <span className={`font-semibold ${PLATFORM_STYLE[l.platform] ?? ""}`}>{l.platform === "direct" ? "Direct" : l.platformLabel}</span>
          <span className="text-mute">
            {l.listingStatus === "verified_listed" ? "listed" : l.listingStatus === "not_listed" ? "not listed" : l.urlKind === "direct_site" ? "site" : "check"}
          </span>
        </span>
      ))}
    </div>
  );
}

export function KindBadge({ restaurant }: { restaurant: Pick<Restaurant, "kind"> }) {
  if (restaurant.kind === "standard") return null;
  const label = restaurant.kind === "virtual_brand" ? "Virtual brand" : restaurant.kind === "ghost_kitchen" ? "Ghost kitchen" : "Delivery only";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky">
      <Ghost className="h-3 w-3" />
      {label}
    </span>
  );
}

export function ModeIcons({ o }: { o: Offering }) {
  const delivery = o.listings.some((l) => l.platform !== "direct" && l.url) || o.listings.some((l) => l.offersDelivery === "yes");
  const pickup = o.restaurant.pickup !== "no" && o.restaurant.kind === "standard";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-dust">
      {delivery && (
        <span className="inline-flex items-center gap-1" title="Delivery may be available — confirm with the provider">
          <Truck className="h-3.5 w-3.5" /> Delivery?
        </span>
      )}
      {pickup && (
        <span className="inline-flex items-center gap-1" title={o.restaurant.pickup === "yes" ? "Pickup reported" : "Pickup likely — confirm"}>
          <Store className="h-3.5 w-3.5" /> Pickup{o.restaurant.pickup === "yes" ? "" : "?"}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> {offeringDistance(o)}
      </span>
    </span>
  );
}
