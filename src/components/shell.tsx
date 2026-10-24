"use client";

import { Bookmark, Flame, User, Users, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { updateProfile, useStore } from "@/lib/client/store";
import { useOnline } from "./use-online";

const NAV = [
  { href: "/discover", label: "Discover", icon: Flame },
  { href: "/likes", label: "Shortlist", icon: Bookmark },
  { href: "/group", label: "Group", icon: Users },
  { href: "/profile", label: "You", icon: User },
];

export function DemoBanner() {
  const demo = useStore((s) => s.profile.demoMode);
  if (!demo) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-sky/90 px-3 py-1.5 pt-[calc(6px+var(--safe-top))] text-center text-[11px] font-bold uppercase tracking-wider text-ink">
      Demo mode — fictional restaurants, not real results
      <button onClick={() => updateProfile({ demoMode: false })} className="rounded-full bg-ink/15 px-2 py-0.5 normal-case tracking-normal underline-offset-2 hover:underline">
        Turn off
      </button>
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-honey/90 px-3 py-1.5 text-xs font-semibold text-ink" role="status">
      <WifiOff className="h-3.5 w-3.5" /> Offline — showing what&apos;s saved on this device. Hours and links may be out of date.
    </div>
  );
}

export function AppShell({ children, header, hideNav }: { children: ReactNode; header?: ReactNode; hideNav?: boolean }) {
  const path = usePathname();
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <DemoBanner />
      <OfflineBanner />
      {header && <header className="sticky top-0 z-30 px-4 pt-[calc(10px+var(--safe-top))] pb-2">{header}</header>}
      <main className={`flex-1 ${hideNav ? "" : "pb-[calc(88px+var(--safe-bottom))]"}`}>{children}</main>
      {!hideNav && (
        <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl rounded-t-3xl px-2 pb-[calc(8px+var(--safe-bottom))] pt-2 sm:bottom-3 sm:rounded-3xl sm:pb-2" aria-label="Main">
          <ul className="grid grid-cols-4">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = path === href || path.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition ${active ? "text-bone" : "text-mute hover:text-dust"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-ember" : ""}`} strokeWidth={active ? 2.4 : 1.8} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({ title, back, right }: { title: string; back?: string | (() => void); right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {back &&
        (typeof back === "string" ? (
          <Link href={back} className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Back">
            <span aria-hidden>←</span>
          </Link>
        ) : (
          <button onClick={back} className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Back">
            <span aria-hidden>←</span>
          </button>
        ))}
      <h1 className="flex-1 font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {right}
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-black italic tracking-tight ${className}`} style={{ fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}>
      <span className="ember-text">crave</span>
    </span>
  );
}
