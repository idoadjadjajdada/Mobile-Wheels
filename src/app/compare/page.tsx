"use client";

import { AnimatePresence, motion } from "motion/react";
import { Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HoursPill, KindBadge, PriceTag } from "@/components/badges";
import { FoodVisual } from "@/components/food-visual";
import { AppShell, PageHeader } from "@/components/shell";
import { Button, EmptyState } from "@/components/states";
import { MARKET_BY_ID } from "@/lib/catalog/markets";
import { api } from "@/lib/client/api";
import { getState, preferenceSnapshot, useHydrated, useStore } from "@/lib/client/store";
import { offeringDistance } from "@/lib/geo";
import { estimateOrder, money } from "@/lib/pricing";
import type { Offering } from "@/lib/types";

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const sp = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const keys = [sp.get("a"), sp.get("b")].filter(Boolean) as string[];
  const [pair, setPair] = useState<Offering[] | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (!hydrated || keys.length !== 2) return;
    const s = getState();
    const fallback = keys.map((k) => s.saved[k]).filter(Boolean);
    api
      .offerings(keys, s.profile.location?.point, preferenceSnapshot())
      .then(({ offerings }) => setPair(keys.map((k) => offerings.find((o) => o.key === k) ?? s.saved[k]).filter(Boolean)))
      .catch(() => setPair(fallback));
    const t = setTimeout(() => setIntro(false), 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sp]);

  if (keys.length !== 2) return <AppShell><EmptyState title="Pick two meals to compare" body="Select two from your shortlist." /></AppShell>;
  if (!pair) return <AppShell hideNav><div className="skeleton m-5 h-96 rounded-3xl" /></AppShell>;
  if (pair.length < 2) return <AppShell><EmptyState title="One of those meals isn't available anymore" /></AppShell>;

  const mode = profile.mode === "pickup" ? "pickup" : "delivery";
  const est = pair.map((o) =>
    estimateOrder({ items: [{ item: o.item, qty: 1 }], taxRate: MARKET_BY_ID.get(o.restaurant.marketId)?.taxRate ?? 0, tipPercent: profile.tipPercent, mode, assumedDeliveryCost: profile.assumedDeliveryCost }),
  );
  const rows: { label: string; render: (o: Offering, i: number) => React.ReactNode; better?: (a: number, b: number) => number; val?: (o: Offering, i: number) => number | undefined }[] = [
    { label: "Price", render: (o) => <PriceTag price={o.item.price} size="sm" /> },
    { label: mode === "pickup" ? "Est. total (tax)" : "Est. delivered", render: (_o, i) => (est[i].hasUnknownPrices ? "—" : `~${money(est[i].total)}`), val: (_o, i) => (est[i].hasUnknownPrices ? undefined : est[i].total), better: (a, b) => a - b },
    { label: "Value", render: (o) => o.value.label, val: (o) => o.value.score, better: (a, b) => b - a },
    { label: "Portion", render: (o) => <span className="capitalize">{o.item.portion.size}</span> },
    { label: "Distance", render: (o) => offeringDistance(o), val: (o) => (o.restaurant.locationless ? undefined : o.distanceKm), better: (a, b) => a - b },
    { label: "Hours", render: (o) => <HoursPill hours={o.hours} compact /> },
    { label: "Delivery", render: (o) => (o.listings.filter((l) => l.url && l.platform !== "direct").length ? `${o.listings.filter((l) => l.url && l.platform !== "direct").length} apps · confirm on site` : "No app links") },
    { label: "Rating", render: (o) => (o.restaurant.rating ? `${o.restaurant.rating.value.toFixed(1)} (${o.restaurant.rating.count ?? "?"})` : "No rating source"), val: (o) => o.restaurant.rating?.value, better: (a, b) => b - a },
    { label: "Calories", render: (o) => (o.item.nutrition?.calories ? `${o.item.nutrition.calories}` : "—") },
  ];

  return (
    <AppShell hideNav header={<PageHeader title="Food fight" back={() => router.back()} />}>
      <AnimatePresence>
        {intro && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center gap-4">
              <motion.div initial={{ x: -200, rotate: -20, opacity: 0 }} animate={{ x: 0, rotate: -6, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
                <FoodVisual item={pair[0].item} className="h-32 w-32 rounded-3xl" size="thumb" />
              </motion.div>
              <motion.span initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 12 }} className="ember-text font-display text-6xl font-black italic">
                VS
              </motion.span>
              <motion.div initial={{ x: 200, rotate: 20, opacity: 0 }} animate={{ x: 0, rotate: 6, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
                <FoodVisual item={pair[1].item} className="h-32 w-32 rounded-3xl" size="thumb" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-32">
        <div className="grid grid-cols-2 gap-3">
          {pair.map((o) => (
            <motion.div key={o.key} animate={winner ? { scale: winner === o.key ? 1.03 : 0.95, opacity: winner === o.key ? 1 : 0.45 } : {}} className={`overflow-hidden rounded-3xl bg-coal ${winner === o.key ? "ring-2 ring-honey" : ""}`}>
              <FoodVisual item={o.item} className="aspect-square" size="thumb" />
              <div className="p-3">
                <h2 className="font-display text-lg font-semibold leading-tight">{o.item.name}</h2>
                <p className="text-xs text-dust">{o.restaurant.name}</p>
                <div className="mt-1"><KindBadge restaurant={o.restaurant} /></div>
              </div>
            </motion.div>
          ))}
        </div>

        <dl className="mt-5 divide-y divide-white/5 rounded-3xl bg-white/[0.03]">
          {rows.map((r) => {
            const vals = r.val ? pair.map((o, i) => r.val!(o, i)) : [];
            const best = r.better && vals.every((v) => v != null) && vals[0] !== vals[1] ? (r.better(vals[0]!, vals[1]!) < 0 ? 0 : 1) : -1;
            return (
              <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 text-sm">
                <dd className={`text-left ${best === 0 ? "font-semibold text-sage" : "text-dust"}`}>{r.render(pair[0], 0)}</dd>
                <dt className="text-center text-[10px] uppercase tracking-wider text-mute">{r.label}</dt>
                <dd className={`text-right ${best === 1 ? "font-semibold text-sage" : "text-dust"}`}>{r.render(pair[1], 1)}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-2 text-center text-[11px] text-mute">Estimates use each meal&apos;s own price data and your fee assumption — never one app&apos;s prices mixed with another&apos;s fees.</p>
      </div>

      <div className="glass-strong fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-[calc(12px+var(--safe-bottom))] pt-3">
        {winner ? (
          <Button className="h-14 w-full text-base" onClick={() => router.push(`/order/${encodeURIComponent(winner)}`)}>
            <Trophy className="h-5 w-5" /> Order the winner
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {pair.map((o, i) => (
              <Button key={o.key} variant={i === 0 ? "outline" : "outline"} className="h-14" onClick={() => setWinner(o.key)}>
                {i === 0 ? "← " : ""}This one{i === 1 ? " →" : ""}
              </Button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
