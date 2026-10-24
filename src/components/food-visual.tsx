"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import { CATEGORY_META } from "./category";

/**
 * Item imagery. We only show a photo when one was supplied with a known license
 * (official / licensed) — otherwise a designed poster, so a stock photo is never
 * passed off as the actual menu item.
 */
export function FoodVisual({ item, className = "", size = "card" }: { item: MenuItem; className?: string; size?: "card" | "thumb" | "hero" }) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;
  const showPhoto = item.image && !failed;

  return (
    <div className={`overflow-hidden ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`} style={{ background: `radial-gradient(120% 90% at 50% 35%, ${meta.from}, ${meta.to} 70%)` }}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image!.url}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading={size === "thumb" ? "lazy" : "eager"}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grain absolute inset-0" aria-hidden>
          <div
            className="absolute left-1/2 top-[38%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: meta.glow, opacity: 0.28 }}
          />
          <Icon
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2"
            style={{ color: meta.glow, opacity: 0.9, width: size === "thumb" ? "42%" : "34%", height: size === "thumb" ? "42%" : "34%", filter: `drop-shadow(0 10px 40px ${meta.glow}66)` }}
            strokeWidth={size === "thumb" ? 1.6 : 1.1}
          />
          {size !== "thumb" && (
            <div
              className="absolute inset-x-0 top-[8%] select-none text-center font-display text-[13vw] font-black uppercase leading-none tracking-tighter text-white/[0.035] sm:text-[90px]"
              style={{ fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
            >
              {meta.label}
            </div>
          )}
        </div>
      )}
      {item.image && !failed && item.image.attribution && size !== "thumb" && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/70">{item.image.attribution}</span>
      )}
      {!showPhoto && size === "hero" && (
        <span className="absolute right-3 top-[calc(16px+var(--safe-top))] rounded-full bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">No verified photo yet</span>
      )}
    </div>
  );
}
