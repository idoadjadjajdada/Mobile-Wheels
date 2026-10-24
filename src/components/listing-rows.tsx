import { CircleHelp, ExternalLink, Store } from "lucide-react";
import type { ListingView, Restaurant } from "@/lib/types";

/** Ordering options with explicit honesty about what each link does and doesn't confirm. */
export function ListingRows({ listings, restaurant, compact, onOpen }: { listings: ListingView[]; restaurant: Pick<Restaurant, "name" | "pickup" | "kind">; compact?: boolean; onOpen?: (l: ListingView) => void }) {
  const usable = listings.filter((l) => l.url);
  if (!usable.length) return <p className="text-sm text-dust">No ordering links on file yet.</p>;
  return (
    <ul className="space-y-2">
      {usable.map((l) => {
        const status =
          l.listingStatus === "verified_listed"
            ? `Listed (verified${l.provenance.verifiedAt ? ` ${new Date(l.provenance.verifiedAt).toLocaleDateString()}` : ""})`
            : l.listingStatus === "reported_listed"
              ? "Reported listed"
              : l.listingStatus === "not_listed"
                ? "Not listed"
                : l.platform === "direct"
                  ? "Restaurant's own site"
                  : "Not verified";
        const linkText = l.urlKind === "search" ? `Search ${l.platformLabel}` : l.platform === "direct" ? "Open ordering site" : `Open on ${l.platformLabel}`;
        return (
          <li key={l.platform} className="glass flex items-center gap-3 rounded-2xl p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-bold">
              {l.platform === "direct" ? <Store className="h-4 w-4" /> : l.platformLabel?.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{l.platform === "direct" ? "Order direct" : l.platformLabel}</div>
              <div className="text-xs text-mute">
                {status}
                {l.offersDelivery === "yes" ? " · delivery reported" : l.offersDelivery === "no" ? " · no delivery reported" : ""}
              </div>
              {!compact && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-honey">
                  <CircleHelp className="h-3 w-3" />
                  {l.capabilities.addressCoverage ? "Coverage checked for your address" : "Check availability for your address on their site"}
                </div>
              )}
            </div>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpen?.(l)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-3 py-2 text-xs font-semibold hover:bg-white/14"
              aria-label={`${linkText} for ${restaurant.name} (opens in a new tab)`}
            >
              {compact ? (l.urlKind === "search" ? "Search" : "Open") : linkText}
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
