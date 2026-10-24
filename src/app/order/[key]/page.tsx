"use client";

import { ExternalLink, Minus, Plus, ShieldAlert, Store, Truck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HoursPill, PriceTag } from "@/components/badges";
import { FoodVisual } from "@/components/food-visual";
import { AppShell, PageHeader } from "@/components/shell";
import { Button, EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import { useOffering } from "@/components/use-offering";
import { MARKET_BY_ID } from "@/lib/catalog/markets";
import { ateHere, updateProfile, useStore } from "@/lib/client/store";
import { estimateOrder, money } from "@/lib/pricing";
import type { ListingView } from "@/lib/types";

/**
 * Order handoff. CRAVE never places or simulates an order: it estimates, then
 * opens the provider's own page. When the user comes back we ask (once) whether
 * they ordered, so "ate here recently" stays accurate without assuming.
 */
export default function OrderPage() {
  const { key: raw } = useParams<{ key: string }>();
  const key = decodeURIComponent(raw);
  const router = useRouter();
  const { show } = useToast();
  const { offering: o, loading, error } = useOffering(key);
  const profile = useStore((s) => s.profile);
  const [fulfil, setFulfil] = useState<"delivery" | "pickup">(profile.mode === "pickup" ? "pickup" : "delivery");
  const [qty, setQty] = useState(1);
  const [combo, setCombo] = useState(false);
  const opened = useRef<ListingView | null>(null);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || !opened.current || !o) return;
      const l = opened.current;
      opened.current = null;
      show({
        message: `Did you order from ${o.chain?.name ?? o.restaurant.name}?`,
        detail: `You opened ${l.platform === "direct" ? "their site" : l.platformLabel}.`,
        duration: 9000,
        actions: [
          { label: "Yes, I ordered", onClick: () => ateHere(o) },
          { label: "Not yet", onClick: () => undefined },
        ],
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [o, show]);

  if (loading) return <AppShell hideNav><div className="skeleton m-5 h-64 rounded-3xl" /></AppShell>;
  if (!o) {
    return (
      <AppShell>
        <EmptyState title="Can't hand off this meal" body={error ?? undefined}>
          <Button onClick={() => router.push("/likes")}>Back to shortlist</Button>
        </EmptyState>
      </AppShell>
    );
  }

  const taxRate = MARKET_BY_ID.get(o.restaurant.marketId)?.taxRate ?? 0;
  const est = estimateOrder({ items: [{ item: o.item, qty, combo }], taxRate, tipPercent: profile.tipPercent, mode: fulfil, assumedDeliveryCost: profile.assumedDeliveryCost });
  const deliveryOptions = o.listings.filter((l) => l.url && l.offersDelivery !== "no" && l.listingStatus !== "not_listed");
  const pickupOptions = o.listings.filter((l) => l.url && (l.platform === "direct" || l.offersPickup === "yes"));
  const canPickup = o.restaurant.kind === "standard" && o.restaurant.pickup !== "no";
  const options = fulfil === "delivery" ? deliveryOptions : pickupOptions;

  return (
    <AppShell hideNav header={<PageHeader title="Order handoff" back={() => router.back()} />}>
      <div className="space-y-5 px-4 pb-16">
        <div className="glass flex gap-4 rounded-3xl p-3">
          <FoodVisual item={o.item} className="h-24 w-24 shrink-0 rounded-2xl" size="thumb" />
          <div className="min-w-0 py-1">
            <h2 className="font-display text-xl font-semibold leading-tight">{o.item.name}</h2>
            <p className="text-sm text-dust">{o.restaurant.name}</p>
            <div className="mt-1.5"><HoursPill hours={o.hours} compact /></div>
          </div>
        </div>

        <div className="glass grid grid-cols-2 rounded-2xl p-1" role="radiogroup" aria-label="Delivery or pickup">
          {(["delivery", "pickup"] as const).map((f) => (
            <button key={f} role="radio" aria-checked={fulfil === f} disabled={f === "pickup" && !canPickup} onClick={() => setFulfil(f)} className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold capitalize transition disabled:opacity-30 ${fulfil === f ? "bg-bone text-ink" : "text-dust"}`}>
              {f === "delivery" ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />} {f}
            </button>
          ))}
        </div>

        <section className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <PriceTag price={combo && o.item.comboPrice ? o.item.comboPrice : o.item.price} size="sm" combo={combo} />
              {o.item.comboPrice && (
                <label className="mt-2 flex items-center gap-2 text-sm text-dust">
                  <input type="checkbox" checked={combo} onChange={(e) => setCombo(e.target.checked)} className="accent-[var(--color-ember)]" /> Make it a meal
                </label>
              )}
            </div>
            <div className="flex items-center gap-2" aria-label="Quantity">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="glass grid h-9 w-9 place-items-center rounded-full" aria-label="Fewer"><Minus className="h-4 w-4" /></button>
              <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
              <button onClick={() => setQty(Math.min(20, qty + 1))} className="glass grid h-9 w-9 place-items-center rounded-full" aria-label="More"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            {est.lines.map((l) => (
              <div key={l.label} className="flex items-start justify-between gap-3">
                <dt className="text-dust">
                  {l.label}
                  {l.note && <span className="block text-[11px] text-mute">{l.note}</span>}
                </dt>
                <dd className="text-right tabular-nums">
                  {est.hasUnknownPrices && l.label === "Items" ? "—" : money(l.amount)}
                  <span className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${l.kind === "verified" || l.kind === "quote" ? "bg-sage/15 text-sage" : l.kind === "user_assumption" ? "bg-sky/15 text-sky" : "bg-honey/15 text-honey"}`}>
                    {l.kind === "user_assumption" ? "yours" : l.kind === "quote" ? "quote" : l.kind === "verified" ? "verified" : "est."}
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold">
              <dt>Estimated total</dt>
              <dd className="tabular-nums">{est.hasUnknownPrices ? "Price unknown" : `~${money(est.total)}`}</dd>
            </div>
            {!est.hasUnknownPrices && est.low !== est.high && <p className="text-right text-[11px] text-mute">Range {money(est.low)}–{money(est.high)}</p>}
          </dl>

          {fulfil === "delivery" && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-dust">
              <label>
                Tip {profile.tipPercent}%
                <input type="range" min={0} max={30} value={profile.tipPercent} onChange={(e) => updateProfile({ tipPercent: Number(e.target.value) })} className="mt-1 w-full" />
              </label>
              <label>
                Your fee estimate ${profile.assumedDeliveryCost}
                <input type="range" min={0} max={15} step={0.5} value={profile.assumedDeliveryCost} onChange={(e) => updateProfile({ assumedDeliveryCost: Number(e.target.value) })} className="mt-1 w-full" />
              </label>
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-mute">{est.disclaimer}</p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{fulfil === "delivery" ? "Choose where to order delivery" : "Order ahead for pickup"}</h3>
          <div className="mb-3 flex gap-2 rounded-2xl bg-honey/10 p-3 text-xs leading-relaxed text-honey">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {fulfil === "delivery"
              ? "CRAVE can't see live delivery coverage, fees or wait times. Enter your address on the provider's site to confirm they deliver to you and are taking orders now."
              : "Confirm the location is open and accepting pickup orders on their site."}
          </div>
          {options.length ? (
            <ul className="space-y-2">
              {options.map((l) => (
                <li key={l.platform}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => (opened.current = l)}
                    className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/10 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{l.platform === "direct" ? `${o.chain?.name ?? o.restaurant.name} (direct)` : l.platformLabel}</div>
                      <div className="text-xs text-mute">
                        {l.urlKind === "search"
                          ? `Opens ${l.platformLabel} search for “${o.chain?.name ?? o.restaurant.name}” — pick this location`
                          : l.urlKind === "verified_store"
                            ? "Opens this store's page (link verified by CRAVE)"
                            : l.urlKind === "direct_site"
                              ? "Opens the restaurant's own ordering site"
                              : "Opens this store's page"}
                      </div>
                    </div>
                    <span className="ember-bg inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-white">
                      Open <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-dust">No {fulfil} ordering link on file for this restaurant.</p>
          )}
          {fulfil === "pickup" && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.restaurant.name, o.restaurant.address.line1, o.restaurant.address.city].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs text-mute underline-offset-4 hover:underline">
              Directions in Google Maps
            </a>
          )}
        </section>
      </div>
    </AppShell>
  );
}
