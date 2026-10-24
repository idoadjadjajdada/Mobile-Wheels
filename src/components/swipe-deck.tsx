"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Bookmark, Heart, Info, Sparkles, Undo2, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Offering, SwipeAction } from "@/lib/types";
import { HoursPill, KindBadge, ModeIcons, PlatformChips, PriceTag } from "./badges";
import { CATEGORY_META } from "./category";
import { FoodVisual } from "./food-visual";

const SWIPE_X = 110;
const SWIPE_Y = 120;
const FLING_V = 650;

export interface SwipeDeckHandle {
  swipe: (action: SwipeAction) => void;
}

interface Props {
  offerings: Offering[];
  onSwipe: (o: Offering, action: SwipeAction) => void;
  onOpen: (o: Offering) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck({ offerings, onSwipe, onOpen, onUndo, canUndo }, ref) {
  const top = offerings[0];
  const topRef = useRef<CardHandle>(null);

  useImperativeHandle(ref, () => ({ swipe: (a) => topRef.current?.fling(a) }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") topRef.current?.fling("like");
      else if (e.key === "ArrowLeft") topRef.current?.fling("pass");
      else if (e.key === "ArrowUp") topRef.current?.fling("save");
      else if ((e.key === "Enter" || e.key === " ") && top && t === document.body) {
        e.preventDefault();
        onOpen(top);
      } else if ((e.key === "Backspace" || e.key.toLowerCase() === "z") && canUndo) onUndo?.();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, onOpen, onUndo, canUndo]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative aspect-[3/4.4] w-full max-w-[420px] select-none"
        // Keep the whole card + action row on screen on short phones.
        style={{ maxWidth: "min(420px, calc((100dvh - 330px) * 0.682))", minWidth: 260 }}
        role="region" aria-label="Meal cards" aria-roledescription="card stack">
        {offerings
          .slice(0, 3)
          .map((o, i) => (
            <SwipeCard key={o.key} ref={i === 0 ? topRef : undefined} offering={o} depth={i} onSwipe={onSwipe} onOpen={onOpen} />
          ))
          .reverse()}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 sm:gap-4" role="group" aria-label="Swipe actions">
        <RoundButton label="Undo last swipe (Z)" onClick={() => onUndo?.()} disabled={!canUndo} size="sm">
          <Undo2 className="h-5 w-5" />
        </RoundButton>
        <RoundButton label="Not interested (←)" onClick={() => topRef.current?.fling("pass")} disabled={!top} tone="pass">
          <X className="h-7 w-7" strokeWidth={2.6} />
        </RoundButton>
        <RoundButton label="Save for later (↑)" onClick={() => topRef.current?.fling("save")} disabled={!top} tone="save" size="sm">
          <Bookmark className="h-5 w-5" strokeWidth={2.4} />
        </RoundButton>
        <RoundButton label="Craving it (→)" onClick={() => topRef.current?.fling("like")} disabled={!top} tone="like">
          <Heart className="h-7 w-7" strokeWidth={2.4} fill="currentColor" />
        </RoundButton>
        <RoundButton label="Details (Enter)" onClick={() => top && onOpen(top)} disabled={!top} size="sm">
          <Info className="h-5 w-5" />
        </RoundButton>
      </div>
    </div>
  );
});

function RoundButton({
  children,
  label,
  onClick,
  disabled,
  tone,
  size = "lg",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "pass" | "like" | "save";
  size?: "sm" | "lg";
}) {
  const dims = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const color =
    tone === "like"
      ? "ember-bg text-white shadow-[0_12px_40px_-10px] shadow-ember/70"
      : tone === "pass"
        ? "glass text-flame"
        : tone === "save"
          ? "glass text-honey"
          : "glass text-dust";
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid ${dims} place-items-center rounded-full transition-opacity disabled:opacity-30 ${color}`}
    >
      {children}
    </motion.button>
  );
}

interface CardHandle {
  fling: (a: SwipeAction) => void;
}

const SwipeCard = forwardRef<CardHandle, { offering: Offering; depth: number; onSwipe: Props["onSwipe"]; onOpen: Props["onOpen"] }>(function SwipeCard(
  { offering: o, depth, onSwipe, onOpen },
  ref,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [20, SWIPE_X], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_X, -20], [1, 0]);
  const saveOpacity = useTransform(y, [-SWIPE_Y, -30], [1, 0]);
  const [gone, setGone] = useState(false);
  const dragged = useRef(false);

  const fling = useCallback(
    (action: SwipeAction) => {
      if (gone) return;
      setGone(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      const target =
        action === "like" ? { x: w * 1.1, y: y.get() + 40 } : action === "pass" ? { x: -w * 1.1, y: y.get() + 40 } : { x: x.get(), y: -window.innerHeight };
      const spring = { type: "spring" as const, stiffness: 260, damping: 30, velocity: 900 };
      animate(x, target.x, spring);
      animate(y, target.y, { ...spring, onComplete: () => onSwipe(o, action) });
    },
    [gone, o, onSwipe, x, y],
  );

  useImperativeHandle(ref, () => ({ fling }), [fling]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.y < -SWIPE_Y && Math.abs(offset.y) > Math.abs(offset.x)) return fling("save");
    if (velocity.y < -FLING_V && Math.abs(velocity.y) > Math.abs(velocity.x)) return fling("save");
    if (offset.x > SWIPE_X || velocity.x > FLING_V) return fling("like");
    if (offset.x < -SWIPE_X || velocity.x < -FLING_V) return fling("pass");
    animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 500, damping: 30 });
  };

  const isTop = depth === 0;
  const meta = CATEGORY_META[o.item.category];
  // The value badge already sits top-right; don't repeat it as the "why" chip.
  const reason = o.reasons.find((r) => !r.startsWith("Lowered") && r !== o.value.label);

  return (
    <motion.article
      className="absolute inset-0 overflow-hidden rounded-[28px] bg-coal shadow-[var(--shadow-card)] will-change-transform"
      style={isTop ? { x, y, rotate, zIndex: 10, touchAction: "none" } : { zIndex: 10 - depth }}
      initial={false}
      animate={isTop ? { scale: 1, y: 0, opacity: 1 } : { scale: 1 - depth * 0.045, y: depth * 14, opacity: depth > 1 ? 0.6 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={isTop && !gone}
      dragElastic={0.9}
      dragMomentum={false}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={onDragEnd}
      onPointerDown={() => (dragged.current = false)}
      onClick={() => !dragged.current && isTop && onOpen(o)}
      aria-hidden={!isTop}
      aria-label={isTop ? `${o.item.name} from ${o.restaurant.name}` : undefined}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <FoodVisual item={o.item} className="absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,transparent_22%,transparent_38%,rgba(11,9,8,0.82)_62%,#0b0908_100%)]" />

      {/* Top row */}
      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
        <span className="glass rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone/90">{meta.label}</span>
        <div className="flex items-center gap-1.5">
          {o.value.score >= 0.8 && <span className="rounded-full bg-sage/20 px-2.5 py-1 text-[11px] font-semibold text-sage">{o.value.label}</span>}
          {o.promotions[0] && <span className="rounded-full bg-honey px-2.5 py-1 text-[11px] font-bold text-ink">Deal</span>}
        </div>
      </div>

      {/* Stamps */}
      {isTop && (
        <>
          <Stamp style={{ opacity: likeOpacity }} className="left-6 top-20 -rotate-12 border-ember text-ember">
            Crave
          </Stamp>
          <Stamp style={{ opacity: passOpacity }} className="right-6 top-20 rotate-12 border-flame/80 text-flame/90">
            Nope
          </Stamp>
          <Stamp style={{ opacity: saveOpacity }} className="left-1/2 top-1/3 -translate-x-1/2 border-honey text-honey">
            Later
          </Stamp>
        </>
      )}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm text-dust">
          <span className="font-medium text-bone/90">{o.restaurant.name}</span>
          <KindBadge restaurant={o.restaurant} />
        </div>
        <h2
          className="font-display text-[32px] font-semibold leading-[1.02] tracking-tight text-bone sm:text-[36px]"
          style={{ fontVariationSettings: "'SOFT' 50, 'opsz' 96", textWrap: "balance" }}
        >
          {o.item.name}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <PriceTag price={o.item.price} />
          <HoursPill hours={o.hours} compact />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ModeIcons o={o} />
        </div>
        <div className="mt-3">
          <PlatformChips listings={o.listings} />
        </div>
        {reason && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember/12 px-3 py-1 text-xs font-medium text-honey">
            <Sparkles className="h-3.5 w-3.5" /> {reason}
          </p>
        )}
      </div>
    </motion.article>
  );
});

function Stamp({ children, className, style }: { children: React.ReactNode; className: string; style: Record<string, unknown> }) {
  return (
    <motion.div
      style={style}
      className={`pointer-events-none absolute rounded-xl border-4 px-4 py-1 font-display text-4xl font-black uppercase italic tracking-tight ${className}`}
      aria-hidden
    >
      {children}
    </motion.div>
  );
}
