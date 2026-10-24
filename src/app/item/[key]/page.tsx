"use client";

import { Ban, Bookmark, Flag, Heart, Info, Moon, ShieldCheck, Sparkles, ThumbsDown, Utensils } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { HoursPill, KindBadge, PriceTag, VerificationNote } from "@/components/badges";
import { CATEGORY_META } from "@/components/category";
import { FoodVisual } from "@/components/food-visual";
import { ListingRows } from "@/components/listing-rows";
import { ReportSheet } from "@/components/report-sheet";
import { AppShell } from "@/components/shell";
import { Button, EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import { useOffering } from "@/components/use-offering";
import { ateHere, block, dislike, rejectMeal, swipe, useStore } from "@/lib/client/store";
import { MARKET_BY_ID } from "@/lib/catalog/markets";
import { formatDistance } from "@/lib/geo";
import { estimateOrder, money, viewPrice } from "@/lib/pricing";

export default function ItemPage() {
  const { key: raw } = useParams<{ key: string }>();
  const key = decodeURIComponent(raw);
  const router = useRouter();
  const { show } = useToast();
  const { offering: o, stale, error, loading } = useOffering(key);
  const profile = useStore((s) => s.profile);
  const isSaved = useStore((s) => !!s.saved[key]);
  const [report, setReport] = useState(false);

  if (loading) {
    return (
      <AppShell hideNav>
        <div className="skeleton aspect-[4/3.4] w-full" />
        <div className="space-y-3 p-5">
          <div className="skeleton h-9 w-2/3 rounded-lg" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
      </AppShell>
    );
  }
  if (!o) {
    return (
      <AppShell>
        <EmptyState icon={<Utensils className="h-7 w-7" />} title="Meal not found" body={error ?? undefined}>
          <Button onClick={() => router.push("/discover")}>Back to discovering</Button>
        </EmptyState>
      </AppShell>
    );
  }

  const meta = CATEGORY_META[o.item.category];
  const brand = o.chain?.name ?? o.restaurant.name;
  const est = estimateOrder({
    items: [{ item: o.item, qty: 1 }],
    taxRate: MARKET_BY_ID.get(o.restaurant.marketId)?.taxRate ?? 0,
    tipPercent: profile.tipPercent,
    mode: profile.mode === "pickup" ? "pickup" : "delivery",
    assumedDeliveryCost: profile.assumedDeliveryCost,
  });
  const price = viewPrice(o.item.price);
  const allergensVerified = o.item.allergens && o.item.allergens.provenance.verification === "verified";

  return (
    <AppShell hideNav>
      <div className="relative">
        <FoodVisual item={o.item} className="aspect-[4/3.4] w-full sm:rounded-b-[32px]" size="hero" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-ink" />
        <button onClick={() => router.back()} className="glass absolute left-4 top-[calc(12px+var(--safe-top))] grid h-10 w-10 place-items-center rounded-full" aria-label="Back">
          ←
        </button>
      </div>

      <div className="relative -mt-16 px-5 pb-[calc(110px+var(--safe-bottom))]">
        {stale && <p className="mb-3 rounded-xl bg-honey/15 px-3 py-2 text-xs text-honey">Showing the copy saved on this device — hours and links may have changed.</p>}
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.glow }}>
          {meta.label}
        </span>
        <h1 className="mt-1 font-display text-4xl font-semibold leading-[1.05] tracking-tight" style={{ textWrap: "balance" }}>
          {o.item.name}
        </h1>
        <Link href={`/restaurant/${encodeURIComponent(o.restaurant.id)}`} className="mt-2 inline-flex flex-wrap items-center gap-2 text-dust hover:text-bone">
          <span className="font-medium text-bone underline decoration-white/20 underline-offset-4">{o.restaurant.name}</span>
          <span>· {formatDistance(o.distanceKm)}</span>
          <KindBadge restaurant={o.restaurant} />
        </Link>
        {o.restaurant.address.line1 && <p className="mt-1 text-sm text-mute">{[o.restaurant.address.line1, o.restaurant.address.city].filter(Boolean).join(", ")}</p>}

        {o.item.description && <p className="mt-4 text-[15px] leading-relaxed text-dust">{o.item.description}</p>}

        {/* Price */}
        <section className="glass mt-6 rounded-3xl p-5" aria-labelledby="price-h">
          <h2 id="price-h" className="sr-only">Price</h2>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <PriceTag price={o.item.price} size="lg" />
              {o.item.comboPrice && (
                <div className="mt-1.5 text-sm text-dust">
                  Meal/combo: <PriceTag price={o.item.comboPrice} size="sm" />
                </div>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${o.value.score >= 0.8 ? "bg-sage/15 text-sage" : "bg-white/8 text-dust"}`}>{o.value.label}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mute">
            {price.status === "verified"
              ? `Verified ${o.item.price.channel ? `(${o.item.price.channel.replace("_", " ")}) ` : ""}${o.item.price.verifiedAt ? `on ${new Date(o.item.price.verifiedAt).toLocaleDateString()}` : ""}. Delivery apps may charge more.`
              : price.status === "unknown"
                ? "No price on file. Check the provider for the current price."
                : "Typical price range from the chain's public menu — not a quote for this location. In-store and delivery-app prices differ."}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Portion" value={o.item.portion.size} />
            <Stat label="Calories" value={o.item.nutrition?.calories ? `${o.item.nutrition.calories}` : "—"} />
            <Stat label={profile.mode === "pickup" ? "Est. w/ tax" : "Est. delivered"} value={est.hasUnknownPrices ? "—" : `~${money(est.total)}`} />
          </div>
          {o.item.nutrition && <div className="mt-2"><VerificationNote v={o.item.nutrition.provenance.verification} source={o.item.nutrition.provenance.attribution} /></div>}
          {o.promotions.map((p) => (
            <p key={p.id} className="mt-3 rounded-xl bg-honey/12 px-3 py-2 text-sm text-honey">
              <strong>{p.title}</strong> {p.detail}
              {p.validUntil ? ` · until ${p.validUntil}` : ""}
            </p>
          ))}
        </section>

        {/* Why */}
        {o.reasons.length > 0 && (
          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-honey" /> Why you&apos;re seeing this</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {o.reasons.map((r) => (
                <li key={r} className={`rounded-full px-3 py-1 text-xs ${r.startsWith("Lowered") ? "bg-white/5 text-mute" : "bg-ember/12 text-honey"}`}>
                  {r}
                </li>
              ))}
            </ul>
            <Link href="/profile#ranking" className="mt-2 inline-block text-xs text-mute underline-offset-4 hover:underline">Tune how CRAVE ranks meals</Link>
          </section>
        )}

        {/* Hours */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Hours</h2>
          <div className="mt-2"><HoursPill hours={o.hours} /></div>
          {o.hours.todayLabel && <p className="mt-1 text-sm text-dust">Today: {o.hours.todayLabel}</p>}
          {o.deliveryHours && <p className="mt-1 text-sm text-dust">Delivery hours: {o.deliveryHours.label}</p>}
          <p className="mt-1 text-xs text-mute">Published hours — not confirmation that a delivery app is taking orders right now.</p>
          {o.restaurant.hours.general?.provenance && (
            <div className="mt-1"><VerificationNote v={o.restaurant.hours.general.provenance.verification} at={o.restaurant.hours.general.provenance.verifiedAt ?? o.restaurant.hours.general.provenance.fetchedAt} source={o.restaurant.hours.general.provenance.attribution} /></div>
          )}
        </section>

        {/* Delivery */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Where to order</h2>
          <div className="mt-2"><ListingRows listings={o.listings} restaurant={o.restaurant} compact /></div>
        </section>

        {/* Allergens */}
        <section className="mt-6 rounded-2xl bg-white/[0.03] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-sage" /> Allergens & diet</h2>
          {allergensVerified ? (
            <p className="mt-1.5 text-sm text-dust">Contains: {o.item.allergens!.contains.join(", ") || "none listed"}</p>
          ) : (
            <p className="mt-1.5 text-sm text-dust">Not verified for this item. Check the restaurant&apos;s allergen guide before ordering if you have allergies.</p>
          )}
          {o.item.dietary.length > 0 && <p className="mt-1 text-sm text-dust">Diet: {o.item.dietary.join(", ")}</p>}
          {o.item.ingredients.length > 0 && <p className="mt-2 text-xs text-mute">Key components: {o.item.ingredients.join(", ")}</p>}
        </section>

        {/* Preferences */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Not feeling it?</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill icon={<ThumbsDown className="h-3.5 w-3.5" />} onClick={() => { rejectMeal(o.item.id, o.item.name); show({ message: "We won't show this meal again", detail: "Undo anytime in Profile." }); router.back(); }}>
              Never show this meal
            </Pill>
            <Pill icon={<Moon className="h-3.5 w-3.5" />} onClick={() => { dislike({ type: "category", id: o.item.category, name: meta.label, reason: "not_tonight" }, 12); show({ message: `No ${meta.label.toLowerCase()} tonight` }); router.back(); }}>
              No {meta.label.toLowerCase()} tonight
            </Pill>
            <Pill icon={<Utensils className="h-3.5 w-3.5" />} onClick={() => { ateHere(o); show({ message: `Noted — ${brand} will rest for a few days` }); }}>
              I ate here recently
            </Pill>
            <Pill danger icon={<Ban className="h-3.5 w-3.5" />} onClick={() => { block({ type: o.restaurant.chainId ? "chain" : "restaurant", id: o.restaurant.chainId ?? o.restaurant.id, name: brand }); show({ message: `${brand} blocked`, detail: "Unblock anytime in Profile." }); router.back(); }}>
              Block {brand}
            </Pill>
          </div>
        </section>

        <div className="mt-8 flex items-center justify-between text-xs text-mute">
          <VerificationNote v={o.item.provenance.verification} at={o.item.provenance.verifiedAt ?? o.item.provenance.fetchedAt} source={o.item.provenance.attribution} />
          <button onClick={() => setReport(true)} className="inline-flex items-center gap-1 hover:text-dust">
            <Flag className="h-3.5 w-3.5" /> Report wrong info
          </button>
        </div>
        <p className="mt-2 flex gap-1.5 text-[11px] text-mute">
          <Info className="h-3.5 w-3.5 shrink-0" /> Restaurant data © OpenStreetMap contributors where noted. Menus compiled from chains&apos; public menus.
        </p>
      </div>

      {/* Sticky actions */}
      <div className="glass-strong fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-2xl gap-2 px-4 pb-[calc(12px+var(--safe-bottom))] pt-3">
        {!isSaved && (
          <>
            <button onClick={() => { swipe(o, "save"); show({ message: "Saved for later" }); }} className="glass grid h-14 w-14 place-items-center rounded-2xl text-honey" aria-label="Save for later">
              <Bookmark className="h-5 w-5" />
            </button>
            <button onClick={() => { swipe(o, "like"); show({ message: "Added to your shortlist" }); }} className="glass grid h-14 w-14 place-items-center rounded-2xl text-ember" aria-label="Craving it">
              <Heart className="h-5 w-5" fill="currentColor" />
            </button>
          </>
        )}
        <Button className="h-14 flex-1 text-base" onClick={() => router.push(`/order/${encodeURIComponent(o.key)}`)}>
          Order now
        </Button>
      </div>

      <ReportSheet open={report} onClose={() => setReport(false)} restaurantId={o.restaurant.id} menuItemId={o.item.id} />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-2 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-0.5 text-sm font-semibold capitalize tabular-nums">{value}</div>
    </div>
  );
}

function Pill({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition active:scale-95 ${danger ? "bg-flame/10 text-flame" : "glass text-dust hover:text-bone"}`}>
      {icon}
      {children}
    </button>
  );
}
