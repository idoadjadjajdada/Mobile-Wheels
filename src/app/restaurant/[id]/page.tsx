"use client";

import { Ban, Flag, MapPin, Moon, Phone, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HoursPill, KindBadge, PriceTag, VerificationNote } from "@/components/badges";
import { FoodVisual } from "@/components/food-visual";
import { ListingRows } from "@/components/listing-rows";
import { ReportSheet } from "@/components/report-sheet";
import { AppShell, PageHeader } from "@/components/shell";
import { Button, EmptyState, ErrorState } from "@/components/states";
import { useToast } from "@/components/toast";
import { api, ApiError, type RestaurantDetail } from "@/lib/client/api";
import { block, dislike, getState, preferenceSnapshot, useHydrated } from "@/lib/client/store";
import { formatDistance } from "@/lib/geo";

export default function RestaurantPage() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const router = useRouter();
  const hydrated = useHydrated();
  const { show } = useToast();
  const [d, setD] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(false);

  const [attempt, setAttempt] = useState(0);
  const load = () => {
    setError(null);
    setAttempt((a) => a + 1);
  };
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    api
      .restaurant(id, getState().profile.location?.point, preferenceSnapshot())
      .then((r) => alive && setD(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load restaurant."));
    return () => {
      alive = false;
    };
  }, [hydrated, id, attempt]);

  if (error) return <AppShell header={<PageHeader title="Restaurant" back={() => router.back()} />}><ErrorState message={error} onRetry={load} /></AppShell>;
  if (!d) return <AppShell hideNav><div className="skeleton m-5 h-72 rounded-3xl" /></AppShell>;
  const r = d.restaurant;
  const brand = d.chain?.name ?? r.name;
  const target = { type: r.chainId ? ("chain" as const) : ("restaurant" as const), id: r.chainId ?? r.id, name: brand };

  return (
    <AppShell hideNav header={<PageHeader title="" back={() => router.back()} />}>
      <div className="space-y-7 px-4 pb-20">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge restaurant={r} />
            {d.chain && <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dust">{d.chain.tier} chain</span>}
            {r.isDemo && <span className="rounded-full bg-sky/20 px-2 py-0.5 text-[10px] font-bold uppercase text-sky">Demo</span>}
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight">{r.name}</h1>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-dust">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
            <span>
              {[r.address.line1, r.address.city, r.address.state].filter(Boolean).join(", ") || "Address not on file"}
              {d.distanceKm != null && ` · ${formatDistance(d.distanceKm)}`}
              {" · "}
              <a href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Map</a>
            </span>
          </p>
          {r.phone && <a href={`tel:${r.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-dust"><Phone className="h-4 w-4" /> {r.phone}</a>}
          {d.host && (
            <p className="mt-3 rounded-2xl bg-sky/10 p-3 text-sm text-sky">
              Virtual brand operating from <Link href={`/restaurant/${encodeURIComponent(d.host.id)}`} className="font-semibold underline">{d.host.name}</Link>&apos;s kitchen. Usually delivery-only.
            </p>
          )}
          {d.rating ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-honey text-honey" /> {d.rating.value.toFixed(1)}
              {d.rating.count != null && <span className="text-dust">({d.rating.count.toLocaleString()} reviews)</span>}
              <span className="text-xs text-mute">via {d.rating.source === "google_places" ? "Google" : d.rating.source}</span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-mute">No rating source connected for this restaurant.</p>
          )}
        </div>

        <section>
          <h2 className="font-display text-xl font-semibold">Hours</h2>
          <div className="mt-2"><HoursPill hours={d.hours.general} /></div>
          {d.hours.kitchenCutoffMinutes ? <p className="mt-1 text-xs text-mute">Kitchen stops orders {d.hours.kitchenCutoffMinutes} min before close.</p> : null}
          <dl className="mt-3 divide-y divide-white/5 rounded-2xl bg-white/[0.03] text-sm">
            {d.hours.weekly.map((w) => (
              <div key={w.day} className="flex justify-between px-4 py-2">
                <dt className="text-dust">{w.day}</dt>
                <dd className="tabular-nums">{w.text}</dd>
              </div>
            ))}
          </dl>
          {d.hours.specials.length > 0 && (
            <div className="mt-3 rounded-2xl bg-honey/10 p-3 text-sm text-honey">
              <strong className="block text-xs uppercase tracking-wider">Special hours</strong>
              {d.hours.specials.map((s) => (
                <p key={s.date}>{new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: {s.text}{s.note ? ` (${s.note})` : ""}</p>
              ))}
            </div>
          )}
          {d.hours.delivery && <p className="mt-3 text-sm text-dust">Delivery hours: {d.hours.delivery.label}</p>}
          {d.hours.pickup && <p className="mt-1 text-sm text-dust">Pickup hours: {d.hours.pickup.label}</p>}
          {d.hours.google && <p className="mt-2 text-xs text-mute">Google currently shows: {d.hours.google.status.label}</p>}
          {d.hours.provenance && <div className="mt-2"><VerificationNote v={d.hours.provenance.verification} at={d.hours.provenance.verifiedAt ?? d.hours.provenance.fetchedAt} source={d.hours.provenance.attribution} /></div>}
          <p className="mt-1 text-xs text-mute">Published hours are not proof that delivery apps are taking orders.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Order</h2>
          <div className="mt-3"><ListingRows listings={d.listings} restaurant={r} /></div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Menu highlights</h2>
          {d.offerings.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.offerings.map((o) => (
                <li key={o.key}>
                  <Link href={`/item/${encodeURIComponent(o.key)}`} className="block overflow-hidden rounded-3xl bg-coal">
                    <FoodVisual item={o.item} className="aspect-[4/3]" size="thumb" />
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{o.item.name}</h3>
                      <div className="mt-1.5"><PriceTag price={o.item.price} size="sm" /></div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No menu data yet" body="We don't have verified menu items for this restaurant. Use an ordering link above to see their full menu." />
          )}
        </section>

        <section className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { dislike({ ...target, reason: "tired_of" }, 24 * 7); show({ message: `${brand} hidden for a week` }); }}>
            <Moon className="h-4 w-4" /> Hide for a week
          </Button>
          <Button variant="danger" onClick={() => { block(target); show({ message: `${brand} blocked`, detail: "Unblock anytime in Profile." }); router.back(); }}>
            <Ban className="h-4 w-4" /> Block {brand}
          </Button>
          <Button variant="ghost" onClick={() => setReport(true)}>
            <Flag className="h-4 w-4" /> Report wrong info
          </Button>
        </section>

        <p className="text-[11px] leading-relaxed text-mute">
          <VerificationNote v={r.provenance.verification} at={r.provenance.verifiedAt ?? r.provenance.fetchedAt} source={r.provenance.attribution ?? r.provenance.source} />
        </p>
      </div>
      <ReportSheet open={report} onClose={() => setReport(false)} restaurantId={r.id} />
    </AppShell>
  );
}
