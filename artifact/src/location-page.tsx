import { Ghost, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { updateProfile, useStore } from "@/lib/client/store";
import { CATALOG_ITEMS } from "@/lib/catalog/menu";
import { CHAIN_RESTAURANTS, MARKET } from "./preview-data";

/** Replaces the address screen: this preview has no geocoder or live restaurant data, so the user picks a data set. */
export function PreviewLocation() {
  const router = useRouter();
  const current = useStore((s) => s.profile.location);
  const pick = (demo: boolean) => {
    updateProfile({
      demoMode: demo,
      location: { label: demo ? "Demo area · Tucson" : "Tucson, AZ · chain menus", point: MARKET.center, precision: "approximate", source: "address" },
    });
    router.push("/discover");
  };
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-10 pt-[calc(16px+var(--safe-top))]">
      <PageHeader title="Pick what to swipe" back={current ? "/discover" : undefined} />
      <p className="mt-3 text-sm leading-relaxed text-dust">
        This is a preview that runs in your browser. The full app finds the actual restaurants around your address from live OpenStreetMap data; that needs CRAVE&apos;s server, so here you choose a data set instead.
      </p>

      <button onClick={() => pick(false)} className="glass mt-6 block w-full rounded-3xl p-5 text-left transition hover:bg-white/10 active:scale-[0.99]">
        <span className="flex items-center gap-2 text-ember"><Store className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Real menus</span></span>
        <span className="mt-2 block font-display text-2xl font-semibold">Chain menus</span>
        <span className="mt-1 block text-sm text-dust">
          {CATALOG_ITEMS.length} real items from {CHAIN_RESTAURANTS.length} national and Tucson chains. Prices are estimated ranges. Ordering links go to the chain&apos;s site and the delivery apps&apos; search. No specific branches, hours or distances.
        </span>
      </button>

      <button onClick={() => pick(true)} className="glass mt-3 block w-full rounded-3xl p-5 text-left transition hover:bg-white/10 active:scale-[0.99]">
        <span className="flex items-center gap-2 text-sky"><Ghost className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Fictional</span></span>
        <span className="mt-2 block font-display text-2xl font-semibold">Demo restaurants</span>
        <span className="mt-1 block text-sm text-dust">Six made-up places with full hours, distances, a virtual brand and late-night kitchens, to show everything the live app does. Clearly marked as demo.</span>
      </button>
    </div>
  );
}
