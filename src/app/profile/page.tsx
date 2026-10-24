"use client";

import { Ban, Database, LogIn, Moon, RotateCcw, ThumbsDown, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNow } from "@/components/use-now";
import { CATEGORY_META } from "@/components/category";
import { AppShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/states";
import { useToast } from "@/components/toast";
import { useRequireSetup } from "@/components/use-setup";
import { Toggle } from "@/components/toggle";
import { SyncPanel } from "@/components/sync-panel";
import { removeDislike, resetEverything, resetPreferences, unblock, unrejectMeal, updateProfile, useStore } from "@/lib/client/store";
import { ALLERGENS } from "@/lib/defaults";
import { DEFAULT_WEIGHTS } from "@/lib/ranking";
import type { RankingWeights } from "@/lib/types";

const WEIGHT_INFO: Record<keyof RankingWeights, { label: string; desc: string }> = {
  taste: { label: "Your taste", desc: "Categories, chains and ingredients you like — from onboarding and your swipes." },
  price: { label: "Price fit", desc: "Fits your budget; lowers pricier items in categories where you keep passing." },
  distance: { label: "Distance", desc: "Closer restaurants rank higher." },
  value: { label: "Value", desc: "Portion and meal completeness for the price — not just cheapness." },
  variety: { label: "Variety", desc: "Rests places you ate at recently and categories you keep passing on." },
  openness: { label: "Open for a while", desc: "Prefers places that aren't about to close." },
};

export default function ProfilePage() {
  useRequireSetup({ location: false });
  const { show } = useToast();
  const router = useRouter();
  const s = useStore((x) => x);
  const p = s.profile;
  const [confirmAll, setConfirmAll] = useState(false);
  const likes = s.swipes.filter((x) => x.action === "like").length;
  const passes = s.swipes.filter((x) => x.action === "pass").length;
  const now = useNow();
  const activeDislikes = s.dislikes.filter((d) => Date.parse(d.until) > now);

  return (
    <AppShell header={<PageHeader title="You" />}>
      <div className="space-y-8 px-4">
        <section className="grid grid-cols-3 gap-2 text-center">
          {[["Craved", likes], ["Passed", passes], ["Saved", Object.keys(s.saved).length]].map(([l, n]) => (
            <div key={l} className="glass rounded-2xl py-3">
              <div className="font-display text-2xl font-semibold">{n}</div>
              <div className="text-[11px] uppercase tracking-wider text-mute">{l}</div>
            </div>
          ))}
        </section>

        <Section title="Location & ordering">
          <Link href="/location" className="glass flex justify-between rounded-2xl p-3.5 text-sm">
            <span className="text-dust">Delivery address</span>
            <span className="max-w-[60%] truncate">{p.location?.label ?? "Not set"}</span>
          </Link>
          <div className="glass rounded-2xl p-3.5 text-sm">
            <div className="flex justify-between"><span className="text-dust">Default tip</span><span>{p.tipPercent}%</span></div>
            <input type="range" min={0} max={30} value={p.tipPercent} onChange={(e) => updateProfile({ tipPercent: Number(e.target.value) })} className="mt-2 w-full" aria-label="Default tip percent" />
            <div className="mt-3 flex justify-between"><span className="text-dust">My usual delivery + service fees</span><span>${p.assumedDeliveryCost}</span></div>
            <input type="range" min={0} max={15} step={0.5} value={p.assumedDeliveryCost} onChange={(e) => updateProfile({ assumedDeliveryCost: Number(e.target.value) })} className="mt-2 w-full" aria-label="Assumed delivery fees" />
            <p className="mt-2 text-xs text-mute">Used only for estimates — CRAVE can&apos;t see real fees, which vary by app, address and time.</p>
          </div>
          <div className="glass rounded-2xl p-3.5 text-sm">
            <div className="flex justify-between"><span className="text-dust">Budget per meal</span><span>{p.budgetMax ? `$${p.budgetMax}` : "No limit"}</span></div>
            <input type="range" min={5} max={51} value={p.budgetMax ?? 51} onChange={(e) => updateProfile({ budgetMax: Number(e.target.value) > 50 ? undefined : Number(e.target.value) })} className="mt-2 w-full" aria-label="Budget" />
          </div>
        </Section>

        <Section title="Allergies">
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = p.allergens.includes(a);
              return (
                <button key={a} aria-pressed={on} onClick={() => updateProfile({ allergens: on ? p.allergens.filter((x) => x !== a) : [...p.allergens, a] })} className={`rounded-full px-3 py-1.5 text-sm capitalize ${on ? "ember-bg text-white" : "glass text-dust"}`}>
                  {a}
                </button>
              );
            })}
          </div>
        </Section>

        <section id="ranking">
          <h2 className="mb-1 font-display text-lg font-semibold">How CRAVE ranks meals</h2>
          <p className="mb-3 text-xs text-mute">A transparent weighted score — no black box. Every card shows the top reasons it was picked. Hard rules always apply first: blocked places, rejected meals and closed restaurants never show.</p>
          <div className="space-y-2">
            {(Object.keys(WEIGHT_INFO) as (keyof RankingWeights)[]).map((k) => (
              <div key={k} className="glass rounded-2xl p-3.5">
                <div className="flex justify-between text-sm"><span className="font-medium">{WEIGHT_INFO[k].label}</span><span className="tabular-nums text-dust">{p.weights[k].toFixed(1)}×</span></div>
                <input type="range" min={0} max={2} step={0.1} value={p.weights[k]} onChange={(e) => updateProfile({ weights: { ...p.weights, [k]: Number(e.target.value) } })} className="mt-2 w-full" aria-label={`${WEIGHT_INFO[k].label} weight`} />
                <p className="text-xs text-mute">{WEIGHT_INFO[k].desc}</p>
              </div>
            ))}
            <button onClick={() => updateProfile({ weights: DEFAULT_WEIGHTS })} className="text-xs text-mute underline-offset-4 hover:underline">Restore default weights</button>
          </div>
        </section>

        <Section title="Taste profile">
          <div className="flex flex-wrap gap-2">
            {Object.entries(p.tastes).filter(([, v]) => v).map(([c, v]) => (
              <span key={c} className={`rounded-full px-3 py-1 text-xs ${v! > 0 ? "bg-ember/15 text-honey" : "bg-white/5 text-mute"}`}>
                {v! > 1 ? "Loves" : v! > 0 ? "Likes" : v! < -1 ? "Never" : "Meh on"} {CATEGORY_META[c as keyof typeof CATEGORY_META]?.label.toLowerCase()}
              </span>
            ))}
            <Link href="/onboarding" className="rounded-full bg-white/5 px-3 py-1 text-xs text-dust">Edit</Link>
          </div>
        </Section>

        <Section title="Blocked (permanent)" icon={<Ban className="h-4 w-4 text-flame" />}>
          {s.blocks.length ? s.blocks.map((b) => <Row key={b.type + b.id} title={b.name} sub={b.type === "chain" ? "Every location" : "This location"} action="Unblock" onClick={() => unblock(b.type, b.id)} />) : <Empty>Nothing blocked.</Empty>}
        </Section>

        <Section title="Taking a break from (temporary)" icon={<Moon className="h-4 w-4 text-honey" />}>
          {activeDislikes.length ? activeDislikes.map((d) => <Row key={d.type + d.id} title={d.name} sub={`${d.reason === "not_tonight" ? "Not tonight" : "Tired of it"} · until ${new Date(d.until).toLocaleString(undefined, { weekday: "short", hour: "numeric" })}`} action="Bring back" onClick={() => removeDislike(d.type, d.id)} />) : <Empty>No temporary dislikes.</Empty>}
        </Section>

        <Section title="Meals you never want to see" icon={<ThumbsDown className="h-4 w-4 text-dust" />}>
          {s.rejections.length ? s.rejections.map((r) => <Row key={r.itemId} title={r.name} action="Allow again" onClick={() => unrejectMeal(r.itemId)} />) : <Empty>None.</Empty>}
        </Section>

        <Section title="Display">
          <Toggle label="Demo mode" desc="Fictional restaurants for trying the app. Never mixed with real results." on={p.demoMode} onChange={(v) => updateProfile({ demoMode: v })} />
        </Section>

        <Section title="Account & sync" icon={<LogIn className="h-4 w-4" />}>
          <SyncPanel />
        </Section>

        <Section title="Reset">
          <Button variant="ghost" className="w-full" onClick={() => { resetPreferences(); show({ message: "Taste history reset", detail: "Blocks and settings were kept." }); }}>
            <RotateCcw className="h-4 w-4" /> Reset taste & swipe history
          </Button>
          {confirmAll ? (
            <Button variant="danger" className="w-full" onClick={() => { resetEverything(); router.replace("/"); }}>
              <Trash2 className="h-4 w-4" /> Tap again to erase everything on this device
            </Button>
          ) : (
            <Button variant="ghost" className="w-full text-flame" onClick={() => setConfirmAll(true)}>
              <Trash2 className="h-4 w-4" /> Erase all CRAVE data on this device
            </Button>
          )}
        </Section>

        <Link href="/about" className="flex items-center gap-2 pb-6 text-xs text-mute hover:text-dust">
          <Database className="h-4 w-4" /> Data sources, accuracy & attributions
        </Link>
      </div>
    </AppShell>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">{icon}{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ title, sub, action, onClick }: { title: string; sub?: string; action: string; onClick: () => void }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {sub && <div className="text-xs text-mute">{sub}</div>}
      </div>
      <button onClick={onClick} className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold hover:bg-white/14">{action}</button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-mute">{children}</p>;
}
