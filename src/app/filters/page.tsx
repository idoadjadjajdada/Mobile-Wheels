"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_META } from "@/components/category";
import { AppShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/states";
import { Toggle } from "@/components/toggle";
import { CHAINS } from "@/lib/catalog/chains";
import { resetFilters, updateFilters, useStore } from "@/lib/client/store";
import { DIETARY } from "@/lib/defaults";
import { BUDGET_PRESETS } from "@/lib/pricing";
import { FOOD_CATEGORIES, type DeliveryPlatform, type Filters, type PortionSize } from "@/lib/types";

const PLATFORMS: { id: DeliveryPlatform; label: string }[] = [
  { id: "direct", label: "Order direct" },
  { id: "doordash", label: "DoorDash" },
  { id: "ubereats", label: "Uber Eats" },
  { id: "grubhub", label: "Grubhub" },
];

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function FiltersPage() {
  const router = useRouter();
  const f = useStore((s) => s.filters);
  const mode = useStore((s) => s.profile.mode);
  const [ingredient, setIngredient] = useState("");
  const set = (patch: Partial<Filters>) => updateFilters(patch);
  const miles = f.maxDistanceKm ? Math.round(f.maxDistanceKm * 0.621371) : 0;

  return (
    <AppShell
      hideNav
      header={<PageHeader title="Filters" back={() => router.back()} right={<button onClick={resetFilters} className="text-sm text-mute hover:text-bone">Reset</button>} />}
    >
      <div className="space-y-7 px-4 pb-32">
        <Section title="Availability">
          <Toggle label="Open now" desc="Hide places without published hours too." on={f.openNow} onChange={(v) => set({ openNow: v })} />
          <Toggle label="Accepting delivery now" desc="Requires a live provider integration. None is available, so this shows nothing rather than guessing." on={f.deliveryNow} onChange={(v) => set({ deliveryNow: v })} />
          <Toggle label="Open at least 30 more minutes" on={f.openAtLeastMinutes === 30} onChange={(v) => set({ openAtLeastMinutes: v ? 30 : undefined })} />
          <Toggle label="Available later tonight" desc="Open sometime between now and 2 AM." on={f.laterTonight} onChange={(v) => set({ laterTonight: v })} />
          <Toggle label="Include closed restaurants" desc="Off by default so the feed only shows what's available now." on={f.includeClosed} onChange={(v) => set({ includeClosed: v })} />
        </Section>

        <Section title="Budget">
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((b) => {
              const on = f.budget.max === b.max && f.budget.min === b.min;
              return (
                <Chip key={b.label} on={on} onClick={() => set({ budget: on ? { includeDeliveryCosts: f.budget.includeDeliveryCosts } : { ...f.budget, min: b.min, max: b.max } })}>
                  {b.label}
                </Chip>
              );
            })}
          </div>
          {mode !== "pickup" && (
            <Toggle label="Include estimated delivery costs" desc="Adds tax, your tip and your fee estimate to each item before comparing to the budget." on={f.budget.includeDeliveryCosts} onChange={(v) => set({ budget: { ...f.budget, includeDeliveryCosts: v } })} />
          )}
          <Toggle label="Include items with unknown prices" on={f.includeUnknownPrices} onChange={(v) => set({ includeUnknownPrices: v })} />
        </Section>

        <Section title="Food">
          <div className="flex flex-wrap gap-2">
            {FOOD_CATEGORIES.map((c) => (
              <Chip key={c} on={f.categories.includes(c)} onClick={() => set({ categories: toggle(f.categories, c) })}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
          <form
            className="glass mt-3 flex items-center gap-2 rounded-2xl p-1.5 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (ingredient.trim()) set({ ingredients: [...new Set([...f.ingredients, ingredient.trim().toLowerCase()])] });
              setIngredient("");
            }}
          >
            <label htmlFor="ing" className="sr-only">Ingredient</label>
            <input id="ing" value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Ingredient (e.g. bacon, avocado)" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-mute" />
            <Button type="submit" variant="ghost" className="py-2">Add</Button>
          </form>
          {f.ingredients.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {f.ingredients.map((i) => (
                <Chip key={i} on onClick={() => set({ ingredients: f.ingredients.filter((x) => x !== i) })}>{i} ✕</Chip>
              ))}
            </div>
          )}
          <h4 className="mt-4 text-xs font-medium text-mute">Portion</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["snack", "regular", "large", "shareable"] as PortionSize[]).map((p) => (
              <Chip key={p} on={!!f.portion?.includes(p)} onClick={() => set({ portion: toggle(f.portion ?? [], p) })}>{p}</Chip>
            ))}
          </div>
          <h4 className="mt-4 text-xs font-medium text-mute">Diet (verified info only)</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIETARY.map((d) => (
              <Chip key={d} on={f.dietary.includes(d)} onClick={() => set({ dietary: toggle(f.dietary, d) })}>{d}</Chip>
            ))}
          </div>
          <Toggle label="Show items with unverified allergen info" desc="Only matters if you listed allergies. Always confirm with the restaurant." on={f.includeUnverifiedAllergens} onChange={(v) => set({ includeUnverifiedAllergens: v })} />
        </Section>

        <Section title="Restaurants">
          <label className="block text-sm">
            <span className="flex justify-between text-dust"><span>Max distance</span><span className="text-bone">{miles ? `${miles} mi` : "Any"}</span></span>
            <input type="range" min={0} max={15} value={miles} onChange={(e) => set({ maxDistanceKm: Number(e.target.value) ? Number(e.target.value) / 0.621371 : undefined })} className="mt-2 w-full" />
          </label>
          <label className="mt-4 block text-sm">
            <span className="flex justify-between text-dust"><span>Min rating (where a rating source exists)</span><span className="text-bone">{f.minRating ? `${f.minRating}+` : "Any"}</span></span>
            <input type="range" min={0} max={4.5} step={0.5} value={f.minRating ?? 0} onChange={(e) => set({ minRating: Number(e.target.value) || undefined })} className="mt-2 w-full" />
          </label>
          <h4 className="mt-4 text-xs font-medium text-mute">Ordering options</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Chip key={p.id} on={f.platforms.includes(p.id)} onClick={() => set({ platforms: toggle(f.platforms, p.id) })}>{p.label}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-mute">Platform filters match listings an admin verified; search links alone don&apos;t count.</p>
          <h4 className="mt-4 text-xs font-medium text-mute">Chains</h4>
          <div className="no-scrollbar mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {CHAINS.map((c) => (
              <Chip key={c.id} on={f.chains.includes(c.id)} onClick={() => set({ chains: toggle(f.chains, c.id) })}>{c.name}</Chip>
            ))}
          </div>
          <h4 className="mt-4 text-xs font-medium text-mute">History</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip on={f.visited === "only"} onClick={() => set({ visited: f.visited === "only" ? "any" : "only" })}>Places I&apos;ve been</Chip>
            <Chip on={f.visited === "exclude"} onClick={() => set({ visited: f.visited === "exclude" ? "any" : "exclude" })}>Skip places I&apos;ve been</Chip>
            <Chip on={f.newOnly} onClick={() => set({ newOnly: !f.newOnly })}>New to me only</Chip>
            <Chip on={f.dealsOnly} onClick={() => set({ dealsOnly: !f.dealsOnly })}>Deals only</Chip>
          </div>
        </Section>
      </div>
      <div className="glass-strong fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-[calc(12px+var(--safe-bottom))] pt-3">
        <Button className="h-14 w-full text-base" onClick={() => router.push("/discover")}>Show meals</Button>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition active:scale-95 ${on ? "ember-bg font-semibold text-white" : "glass text-dust hover:text-bone"}`}>
      {children}
    </button>
  );
}
