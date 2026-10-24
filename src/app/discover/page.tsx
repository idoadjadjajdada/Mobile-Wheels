"use client";

import { AnimatePresence, motion } from "motion/react";
import { Database, MapPin, Shuffle, SlidersHorizontal, Sparkles, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HoursPill, PriceTag } from "@/components/badges";
import { CATEGORY_META } from "@/components/category";
import { FoodVisual } from "@/components/food-visual";
import { AppShell, Wordmark } from "@/components/shell";
import { Button, DeckSkeleton, EmptyState, ErrorState } from "@/components/states";
import { SwipeDeck, type SwipeDeckHandle } from "@/components/swipe-deck";
import { useToast } from "@/components/toast";
import { useRequireSetup } from "@/components/use-setup";
import { useOnline } from "@/components/use-online";
import { api, ApiError, type DeckMeta } from "@/lib/client/api";
import {
  block,
  dislike,
  getState,
  markDeck,
  preferenceSnapshot,
  rejectMeal,
  swipe,
  undoLast,
  updateFilters,
  updateProfile,
  useStore,
} from "@/lib/client/store";
import { surprisePick } from "@/lib/ranking";
import type { DeliveryMode, Offering, SwipeAction } from "@/lib/types";

/** Survives client-side navigation (detail → back) so the stack doesn't reshuffle. */
let deckCache: { signature: string; queue: Offering[]; meta: DeckMeta } | null = null;

export default function Discover() {
  const ready = useRequireSetup();
  const router = useRouter();
  const online = useOnline();
  const { show } = useToast();
  const deckRef = useRef<SwipeDeckHandle>(null);

  const location = useStore((s) => s.profile.location);
  const demo = useStore((s) => s.profile.demoMode);
  const mode = useStore((s) => s.profile.mode);
  const filters = useStore((s) => s.filters);
  const canUndo = useStore((s) => s.undo.length > 0);
  const point = useMemo(() => location?.point ?? { lat: 32.2226, lng: -110.9747 }, [location?.point]);

  const signature = useMemo(() => JSON.stringify({ point, filters, mode, demo }), [point, filters, mode, demo]);
  const cached = deckCache?.signature === signature ? deckCache : null;
  const [queue, setQueue] = useState<Offering[]>(() => cached?.queue ?? []);
  const [meta, setMeta] = useState<DeckMeta | null>(() => cached?.meta ?? null);
  /** Which request signature the visible deck belongs to; loading = it doesn't match the current one. */
  const [loadedFor, setLoadedFor] = useState<string | null>(() => (cached ? signature : null));
  const [error, setError] = useState<{ sig: string; message: string } | null>(null);
  const [surprise, setSurprise] = useState<Offering | null>(null);
  const fetching = useRef(false);
  const loading = loadedFor !== signature && error?.sig !== signature;

  // Only updates state from promise callbacks, so it's safe to call from effects.
  const load = useCallback(
    (opts: { append?: boolean } = {}) => {
      if (fetching.current) return;
      fetching.current = true;
      const sig = signature;
      api
        .deck(point, preferenceSnapshot())
        .then((res) => {
          setMeta(res.meta);
          setQueue((q) => {
            const next = opts.append ? [...q, ...res.offerings.filter((o) => !q.some((x) => x.key === o.key))] : res.offerings;
            deckCache = { signature: sig, queue: next, meta: res.meta };
            return next;
          });
          setLoadedFor(sig);
          setError(null);
          markDeck(res.offerings.length);
        })
        .catch((err) => setError({ sig, message: err instanceof ApiError ? err.message : "Couldn't load meals." }))
        .finally(() => {
          fetching.current = false;
        });
    },
    [signature, point],
  );

  const retry = () => {
    setError(null);
    load();
  };

  useEffect(() => {
    if (!ready || loadedFor === signature) return;
    load();
  }, [ready, signature, loadedFor, load]);

  const removeTop = (o: Offering) =>
    setQueue((q) => {
      const next = q.filter((x) => x.key !== o.key);
      if (deckCache) deckCache.queue = next;
      return next;
    });

  const onSwipe = useCallback(
    (o: Offering, action: SwipeAction) => {
      swipe(o, action);
      removeTop(o);
      const brand = o.chain?.name ?? o.restaurant.name;
      const cat = CATEGORY_META[o.item.category].label.toLowerCase();
      if (action === "pass") {
        // Capture *why* without slowing anyone down: a skippable prompt with the three distinct preference types.
        show({
          message: `Passed on ${o.item.name}`,
          duration: 5000,
          actions: [
            { label: "Never show this meal", onClick: () => rejectMeal(o.item.id, o.item.name) },
            { label: `Not tonight: ${cat}`, onClick: () => dislike({ type: "category", id: o.item.category, name: CATEGORY_META[o.item.category].label, reason: "not_tonight" }, 12) },
            { label: `Tired of ${brand} (1 wk)`, onClick: () => dislike({ type: o.restaurant.chainId ? "chain" : "restaurant", id: o.restaurant.chainId ?? o.restaurant.id, name: brand, reason: "tired_of" }, 24 * 7) },
            { label: `Block ${brand}`, tone: "danger", onClick: () => block({ type: o.restaurant.chainId ? "chain" : "restaurant", id: o.restaurant.chainId ?? o.restaurant.id, name: brand }) },
          ],
        });
      } else if (action === "save") {
        show({ message: "Saved for later", detail: "Find it in your Shortlist.", duration: 1800 });
      }
      if (getState().group) {
        const g = getState().group!;
        api.groupSwipe(g.code, { memberId: g.memberId, offeringKey: o.key, restaurantId: o.restaurant.id, action }).catch(() => undefined);
      }
    },
    [show],
  );

  // Top up the stack before it runs dry.
  useEffect(() => {
    if (ready && !loading && queue.length > 0 && queue.length < 5 && meta && meta.itemsConsidered > 0) load({ append: true });
  }, [queue.length, loading, ready, meta, load]);

  const onUndo = () => {
    const o = undoLast();
    if (o) setQueue((q) => [o, ...q.filter((x) => x.key !== o.key)]);
  };

  const open = useCallback((o: Offering) => router.push(`/item/${encodeURIComponent(o.key)}`), [router]);

  const activeFilters =
    filters.categories.length +
    filters.chains.length +
    filters.platforms.length +
    filters.ingredients.length +
    filters.dietary.length +
    (filters.budget.max != null || filters.budget.min != null ? 1 : 0) +
    (filters.maxDistanceKm ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.openNow ? 1 : 0) +
    (filters.deliveryNow ? 1 : 0) +
    (filters.openAtLeastMinutes ? 1 : 0) +
    (filters.laterTonight ? 1 : 0) +
    (filters.dealsOnly ? 1 : 0) +
    (filters.newOnly ? 1 : 0) +
    (filters.visited !== "any" ? 1 : 0) +
    (filters.portion?.length ? 1 : 0) +
    (filters.includeClosed ? 1 : 0);

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Wordmark className="text-[34px] leading-none" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const pick = surprisePick(queue);
              if (pick) setSurprise(pick);
              else show({ message: "Nothing to surprise you with yet", detail: "Load some meals first." });
            }}
            className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium"
            aria-label="Surprise me"
          >
            <Shuffle className="h-4 w-4 text-honey" /> <span className="hidden sm:inline">Surprise me</span>
          </button>
          <Link href="/filters" className="glass relative grid h-10 w-10 place-items-center rounded-full" aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ""}`}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters > 0 && <span className="ember-bg absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold">{activeFilters}</span>}
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/location" className="glass inline-flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-ember" />
          <span className="truncate text-dust">{demo ? "Demo area · Tucson" : (location?.label ?? "Set location")}</span>
        </Link>
        <div className="glass flex rounded-full p-0.5" role="radiogroup" aria-label="Delivery or pickup">
          {(["delivery", "pickup", "both"] as DeliveryMode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => updateProfile({ mode: m })}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${mode === m ? "bg-bone text-ink" : "text-mute"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell header={header}>
      <div className="px-4 pt-2">
        {!ready || (loading && !queue.length) ? (
          <DeckSkeleton />
        ) : error && error.sig === signature && !queue.length ? (
          <ErrorState message={error.message} onRetry={retry} offline={!online} />
        ) : queue.length ? (
          <>
            <SwipeDeck ref={deckRef} offerings={queue} onSwipe={onSwipe} onOpen={open} onUndo={onUndo} canUndo={canUndo} />
            <p className="mt-4 text-center text-[11px] text-mute">
              Prices marked <span className="text-honey">Est.</span> are typical ranges, not quotes. Delivery availability is confirmed on the provider&apos;s site.
            </p>
          </>
        ) : (
          <DeckEmpty meta={meta} onReload={retry} />
        )}
      </div>

      <AnimatePresence>{surprise && <SurpriseReveal o={surprise} onClose={() => setSurprise(null)} onAgain={() => setSurprise(surprisePick(queue.filter((q) => q.key !== surprise.key)) ?? null)} />}</AnimatePresence>
    </AppShell>
  );
}

function DeckEmpty({ meta, onReload }: { meta: DeckMeta | null; onReload: () => void }) {
  const filters = useStore((s) => s.filters);
  if (meta?.outsideMarket) {
    return (
      <EmptyState icon={<MapPin className="h-7 w-7" />} title="We're not in your area yet" body="CRAVE currently covers Tucson, Arizona. We'd rather show nothing than make things up.">
        <Link href="/location" className="ember-bg rounded-2xl px-5 py-3 text-center text-sm font-semibold text-white">
          Change address
        </Link>
        <Button variant="ghost" onClick={() => updateProfile({ demoMode: true })}>
          Explore demo mode
        </Button>
      </EmptyState>
    );
  }
  if (meta && meta.mode === "live" && meta.restaurantsConsidered === 0) {
    return (
      <EmptyState
        icon={<Database className="h-7 w-7" />}
        title="No restaurant data loaded here yet"
        body={
          <>
            This CRAVE instance hasn&apos;t pulled restaurants for this area. If you run it, open <Link className="text-honey underline" href="/admin">Admin</Link> and run a refresh — it discovers real places from OpenStreetMap.
          </>
        }
      >
        <Button variant="ghost" onClick={() => updateProfile({ demoMode: true })}>
          Explore demo mode instead
        </Button>
      </EmptyState>
    );
  }
  const ex = meta?.excluded ?? {};
  const closed = ex.closed ?? 0;
  const swiped = ex.already_swiped ?? 0;
  return (
    <EmptyState
      icon={<UtensilsCrossed className="h-7 w-7" />}
      title={swiped && !closed && !ex.filter ? "You've seen everything nearby" : "Nothing matches right now"}
      body={
        <span className="block space-y-1">
          {filters.deliveryNow && !meta?.liveDeliveryVerification && (
            <span className="block text-honey">“Accepting delivery now” needs a live provider integration, which isn&apos;t available — so nothing can honestly qualify.</span>
          )}
          {closed > 0 && <span className="block">{closed} meal{closed === 1 ? " is" : "s are"} at places that are closed now.</span>}
          {(ex.filter ?? 0) > 0 && <span className="block">{ex.filter} hidden by your filters.</span>}
          {swiped > 0 && <span className="block">{swiped} already swiped.</span>}
          {(meta?.restaurantsWithoutMenu ?? 0) > 0 && <span className="block">{meta!.restaurantsWithoutMenu} nearby restaurants don&apos;t have menu data yet.</span>}
        </span>
      }
    >
      {filters.deliveryNow && (
        <Button onClick={() => updateFilters({ deliveryNow: false, openNow: true })}>Show open now instead</Button>
      )}
      {closed > 0 && !filters.includeClosed && (
        <Button variant="ghost" onClick={() => updateFilters({ includeClosed: true })}>
          Include closed restaurants
        </Button>
      )}
      <Link href="/filters" className="glass rounded-2xl px-5 py-3 text-center text-sm font-semibold">
        Adjust filters
      </Link>
      <Button variant="ghost" onClick={onReload}>
        Refresh
      </Button>
    </EmptyState>
  );
}

function SurpriseReveal({ o, onClose, onAgain }: { o: Offering; onClose: () => void; onAgain: () => void }) {
  const router = useRouter();
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Surprise pick">
      <motion.div
        key={o.key}
        className="w-full max-w-sm overflow-hidden rounded-[28px] bg-coal shadow-[var(--shadow-card)]"
        initial={{ rotateY: 90, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
        style={{ transformPerspective: 1000 }}
      >
        <FoodVisual item={o.item} className="aspect-[4/3]" size="hero" />
        <div className="p-5">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-honey">
            <Sparkles className="h-3.5 w-3.5" /> Tonight&apos;s pick
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">{o.item.name}</h2>
          <p className="mt-1 text-sm text-dust">{o.restaurant.name}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PriceTag price={o.item.price} size="sm" />
            <HoursPill hours={o.hours} compact />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onAgain}>
              Spin again
            </Button>
            <Button onClick={() => router.push(`/order/${encodeURIComponent(o.key)}`)}>Let&apos;s eat</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
