"use client";

import { Bookmark, Heart, Swords, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HoursPill, PriceTag } from "@/components/badges";
import { FoodVisual } from "@/components/food-visual";
import { AppShell, PageHeader } from "@/components/shell";
import { Button, EmptyState } from "@/components/states";
import { useRequireSetup } from "@/components/use-setup";
import { removeSaved, useStore } from "@/lib/client/store";
import type { Offering } from "@/lib/types";

export default function LikesPage() {
  useRequireSetup({ location: false });
  const router = useRouter();
  const saved = useStore((s) => s.saved);
  const swipes = useStore((s) => s.swipes);
  const [tab, setTab] = useState<"like" | "save">("like");
  const [picked, setPicked] = useState<string[]>([]);

  const latestAction = (key: string) => swipes.findLast((s) => s.key === key)?.action;
  const items = Object.values(saved)
    .filter((o) => latestAction(o.key) === tab)
    .sort((a, b) => (swipes.findLastIndex((s) => s.key === b.key) ?? 0) - (swipes.findLastIndex((s) => s.key === a.key) ?? 0));

  const togglePick = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p.slice(-1), k]));

  return (
    <AppShell header={<PageHeader title="Shortlist" />}>
      <div className="px-4">
        <div className="glass grid grid-cols-2 rounded-2xl p-1" role="tablist">
          {(["like", "save"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${tab === t ? "bg-bone text-ink" : "text-dust"}`}>
              {t === "like" ? <Heart className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {t === "like" ? "Craving" : "Saved for later"}
            </button>
          ))}
        </div>

        {items.length >= 2 && (
          <p className="mt-3 text-center text-xs text-mute">Tap two meals to compare them head-to-head.</p>
        )}

        {items.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((o) => (
              <ShortlistCard key={o.key} o={o} picked={picked.includes(o.key)} onPick={() => togglePick(o.key)} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={tab === "like" ? <Heart className="h-7 w-7" /> : <Bookmark className="h-7 w-7" />} title={tab === "like" ? "Nothing you're craving yet" : "Nothing saved yet"} body={tab === "like" ? "Swipe right on meals you want. They'll land here." : "Swipe up to save meals for another day."}>
            <Link href="/discover" className="ember-bg rounded-2xl px-5 py-3 text-center text-sm font-semibold text-white">Start swiping</Link>
          </EmptyState>
        )}
      </div>

      {picked.length === 2 && (
        <div className="fixed inset-x-0 bottom-[calc(92px+var(--safe-bottom))] z-40 mx-auto flex max-w-md justify-center px-4">
          <Button className="w-full shadow-2xl" onClick={() => router.push(`/compare?a=${encodeURIComponent(picked[0])}&b=${encodeURIComponent(picked[1])}`)}>
            <Swords className="h-4 w-4" /> Food fight: compare these two
          </Button>
        </div>
      )}
    </AppShell>
  );
}

function ShortlistCard({ o, picked, onPick }: { o: Offering; picked: boolean; onPick: () => void }) {
  return (
    <li className={`group relative overflow-hidden rounded-3xl bg-coal transition ${picked ? "ring-2 ring-ember" : ""}`}>
      <button onClick={onPick} className="block w-full text-left" aria-pressed={picked} aria-label={`Select ${o.item.name} to compare`}>
        <FoodVisual item={o.item} className="aspect-square" size="thumb" />
        <div className="p-3">
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-tight">{o.item.name}</h3>
          <p className="mt-0.5 truncate text-xs text-dust">{o.restaurant.name}</p>
          <div className="mt-2"><PriceTag price={o.item.price} size="sm" /></div>
          <div className="mt-1"><HoursPill hours={o.hours} compact /></div>
        </div>
      </button>
      <div className="flex gap-1 px-3 pb-3">
        <Link href={`/order/${encodeURIComponent(o.key)}`} className="ember-bg flex-1 rounded-xl py-2 text-center text-xs font-bold text-white">Order</Link>
        <Link href={`/item/${encodeURIComponent(o.key)}`} className="glass rounded-xl px-3 py-2 text-xs">Info</Link>
        <button onClick={() => removeSaved(o.key)} className="glass rounded-xl px-2.5 text-mute hover:text-flame" aria-label={`Remove ${o.item.name}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {picked && <span className="ember-bg absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold">VS</span>}
    </li>
  );
}
