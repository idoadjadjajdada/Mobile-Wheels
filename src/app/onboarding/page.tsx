"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_META } from "@/components/category";
import { Wordmark } from "@/components/shell";
import { Button } from "@/components/states";
import { ALLERGENS, DIETARY } from "@/lib/defaults";
import { updateProfile, useStore } from "@/lib/client/store";
import type { DeliveryMode, FoodCategory, UserProfile } from "@/lib/types";

const TASTE_CATEGORIES: FoodCategory[] = ["burgers", "chicken", "pizza", "tacos", "mexican", "sandwiches", "asian", "bowls", "breakfast", "salads", "seafood", "desserts"];
const LEVELS = [
  { v: 2, label: "Love" },
  { v: 1, label: "Like" },
  { v: -1, label: "Meh" },
  { v: -2, label: "Never" },
];

export default function Onboarding() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const [step, setStep] = useState(0);
  const [tastes, setTastes] = useState<UserProfile["tastes"]>(profile.tastes);
  const [allergens, setAllergens] = useState<string[]>(profile.allergens);
  const [dietary, setDietary] = useState<string[]>(profile.dietary);
  const [budget, setBudget] = useState<number | undefined>(profile.budgetMax ?? 20);
  const [portion, setPortion] = useState<UserProfile["portionPreference"]>(profile.portionPreference);
  const [mode, setMode] = useState<DeliveryMode>(profile.mode);

  const finish = () => {
    updateProfile({ tastes, allergens, dietary, budgetMax: budget, portionPreference: portion, mode, onboarded: true });
    router.push("/location");
  };

  const steps = [
    <div key="hi" className="flex flex-1 flex-col justify-center">
      <Wordmark className="text-7xl sm:text-8xl" />
      <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl" style={{ textWrap: "balance" }}>
        Hungry, undecided, and done scrolling?
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-dust">
        Swipe real meals from real restaurants near you. We show honest prices, hours, and where to order — and we&apos;ll tell you when something can&apos;t be verified.
      </p>
      <ul className="mt-8 space-y-3 text-sm text-dust">
        {["Right = craving it. Left = nope. Up = save for later.", "Learns your taste — and explains every pick.", "Hands you off to the real ordering page. We never fake an order."].map((t) => (
          <li key={t} className="flex gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ember" /> {t}
          </li>
        ))}
      </ul>
    </div>,

    <div key="taste">
      <h2 className="font-display text-3xl font-semibold tracking-tight">What are you usually into?</h2>
      <p className="mt-2 text-sm text-dust">Tap through a few. Skip anything you don&apos;t care about — CRAVE learns from your swipes either way.</p>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TASTE_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const Icon = meta.icon;
          const current = tastes[c];
          return (
            <div key={c} className="glass rounded-2xl p-3" style={current && current > 0 ? { boxShadow: `inset 0 0 0 1.5px ${meta.glow}` } : undefined}>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5" style={{ color: meta.glow }} />
                <span className="font-medium">{meta.label}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-1" role="radiogroup" aria-label={`${meta.label} preference`}>
                {LEVELS.map((l) => (
                  <button
                    key={l.v}
                    role="radio"
                    aria-checked={current === l.v}
                    onClick={() => setTastes((t) => ({ ...t, [c]: t[c] === l.v ? undefined : l.v }))}
                    className={`rounded-lg py-1 text-[10px] font-semibold transition ${
                      current === l.v ? (l.v > 0 ? "ember-bg text-white" : "bg-white/20 text-bone") : "bg-white/5 text-mute hover:text-dust"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>,

    <div key="diet">
      <h2 className="font-display text-3xl font-semibold tracking-tight">Anything we should avoid?</h2>
      <p className="mt-2 text-sm text-dust">
        Only shared if you choose. If you list an allergy, we hide items without <em>verified</em> allergen info by default — most restaurant data isn&apos;t verified, so always confirm with the restaurant.
      </p>
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mute">Allergies</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALLERGENS.map((a) => (
          <Chip key={a} on={allergens.includes(a)} onClick={() => setAllergens((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>
            {a}
          </Chip>
        ))}
      </div>
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-mute">Diet</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {DIETARY.map((a) => (
          <Chip key={a} on={dietary.includes(a)} onClick={() => setDietary((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>
            {a}
          </Chip>
        ))}
      </div>
    </div>,

    <div key="budget">
      <h2 className="font-display text-3xl font-semibold tracking-tight">Budget & appetite</h2>
      <label className="mt-6 block">
        <span className="flex items-baseline justify-between text-sm">
          <span className="text-dust">Usual max per meal</span>
          <span className="font-display text-3xl font-semibold tabular-nums">{budget ? `$${budget}` : "No limit"}</span>
        </span>
        <input type="range" min={5} max={51} step={1} value={budget ?? 51} onChange={(e) => setBudget(Number(e.target.value) > 50 ? undefined : Number(e.target.value))} className="mt-3 w-full" />
      </label>
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-mute">Portion</h3>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(["light", "regular", "hearty", "any"] as const).map((p) => (
          <Chip key={p} on={portion === p} onClick={() => setPortion(p)} block>
            {p}
          </Chip>
        ))}
      </div>
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-mute">How do you usually get food?</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(["delivery", "pickup", "both"] as const).map((m) => (
          <Chip key={m} on={mode === m} onClick={() => setMode(m)} block>
            {m}
          </Chip>
        ))}
      </div>
    </div>,
  ];

  const last = step === steps.length - 1;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pb-[calc(24px+var(--safe-bottom))] pt-[calc(24px+var(--safe-top))]">
      <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? "ember-bg" : "bg-white/10"}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="flex flex-1 flex-col" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          {steps[step]}
        </motion.div>
      </AnimatePresence>
      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button className="flex-1" onClick={() => (last ? finish() : setStep(step + 1))}>
          {step === 0 ? "Let's eat" : last ? "Set my location" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children, block }: { on: boolean; onClick: () => void; children: React.ReactNode; block?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition active:scale-95 ${block ? "w-full" : ""} ${
        on ? "ember-bg text-white" : "glass text-dust hover:text-bone"
      }`}
    >
      {children}
    </button>
  );
}
