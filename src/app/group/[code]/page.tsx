"use client";

import { Copy, Flame, PartyPopper, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PriceTag } from "@/components/badges";
import { FoodVisual } from "@/components/food-visual";
import { AppShell, PageHeader } from "@/components/shell";
import { Button, EmptyState, ErrorState } from "@/components/states";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/client/api";
import { getState, preferenceSnapshot, setGroup, useHydrated, useStore } from "@/lib/client/store";
import type { Offering } from "@/lib/types";

type GroupState = Awaited<ReturnType<typeof api.group>>;

export default function GroupRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const { show } = useToast();
  const group = useStore((s) => s.group);
  const memberId = useStore((s) => s.memberId);
  const [state, setState] = useState<GroupState | null>(null);
  const [matches, setMatches] = useState<Offering[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const isMember = group?.code === code.toUpperCase();

  useEffect(() => {
    if (!hydrated || !isMember) return;
    let stop = false;
    const tick = async () => {
      try {
        const g = await api.group(code, memberId);
        if (stop) return;
        setState(g);
        setError(null);
        if (g.matches.length) {
          const known = new Set(matches.map((m) => m.key));
          if (g.matches.some((k) => !known.has(k))) {
            const { offerings } = await api.offerings(g.matches, getState().profile.location?.point ?? g.center, preferenceSnapshot());
            if (!stop) setMatches(offerings);
          }
        }
      } catch (e) {
        if (!stop) setError(e instanceof ApiError ? e.message : "Couldn't reach the group");
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isMember, code, memberId]);

  if (!hydrated) return null;

  if (!isMember) {
    return (
      <AppShell header={<PageHeader title={`Join ${code.toUpperCase()}`} back="/group" />}>
        <div className="space-y-3 px-4">
          <p className="text-sm text-dust">You&apos;ve been invited to swipe together.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" aria-label="Your name" className="glass w-full rounded-xl px-3 py-3 outline-none" />
          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={async () => {
              try {
                await api.joinGroup(code, { memberId, displayName: name });
                setGroup({ code: code.toUpperCase(), memberId, displayName: name });
                if (!getState().profile.onboarded) router.push("/onboarding");
              } catch (e) {
                show({ message: e instanceof ApiError ? e.message : "Couldn't join" });
              }
            }}
          >
            Join group
          </Button>
        </div>
      </AppShell>
    );
  }

  const share = async () => {
    const url = `${window.location.origin}/group/${code.toUpperCase()}`;
    try {
      if (navigator.share) await navigator.share({ title: "Swipe with me on CRAVE", text: `Join my CRAVE group: ${code.toUpperCase()}`, url });
      else {
        await navigator.clipboard.writeText(url);
        show({ message: "Invite link copied" });
      }
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <AppShell header={<PageHeader title={state?.name ?? "Group"} back="/group" right={<button onClick={share} className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Share invite"><Share2 className="h-4 w-4" /></button>} />}>
      <div className="space-y-6 px-4">
        {error && <ErrorState message={error} />}
        <div className="glass flex items-center justify-between rounded-3xl p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-mute">Group code</p>
            <p className="font-mono text-3xl font-bold tracking-[0.25em]">{code.toUpperCase()}</p>
          </div>
          <button onClick={() => navigator.clipboard?.writeText(code.toUpperCase()).then(() => show({ message: "Code copied" }))} className="rounded-full bg-white/8 p-3" aria-label="Copy code">
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <section>
          <h2 className="mb-2 font-display text-lg font-semibold">Who&apos;s swiping</h2>
          <ul className="space-y-2">
            {state?.members.map((m, i) => (
              <li key={i} className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                <span>{m.displayName}{m.isMe && <span className="ml-1 text-mute">(you)</span>}</span>
                <span className="text-dust">{m.swipes} swipes</span>
              </li>
            ))}
          </ul>
          {state && state.members.length < 2 && <p className="mt-2 text-xs text-honey">Share the code — matches appear once at least two people swipe.</p>}
        </section>

        <Link href="/discover" className="ember-bg flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-white">
          <Flame className="h-5 w-5" /> Swipe for the group
        </Link>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><PartyPopper className="h-5 w-5 text-honey" /> Everyone wants</h2>
          {matches.length ? (
            <ul className="grid grid-cols-2 gap-3">
              {matches.map((o) => (
                <li key={o.key} className="overflow-hidden rounded-3xl bg-coal">
                  <FoodVisual item={o.item} className="aspect-square" size="thumb" />
                  <div className="p-3">
                    <h3 className="font-display font-semibold leading-tight">{o.item.name}</h3>
                    <p className="text-xs text-dust">{o.restaurant.name}</p>
                    <div className="mt-1"><PriceTag price={o.item.price} size="sm" /></div>
                    <Link href={`/order/${encodeURIComponent(o.key)}`} className="ember-bg mt-2 block rounded-xl py-2 text-center text-xs font-bold text-white">Order</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No unanimous picks yet" body={state && state.restaurantMatches.length ? `${state.restaurantMatches.length} restaurant${state.restaurantMatches.length === 1 ? "" : "s"} everyone liked something from — keep swiping to find the exact meal.` : "Keep swiping. Meals everyone likes show up here automatically."} />
          )}
        </section>

        <button onClick={() => { setGroup(undefined); router.push("/group"); }} className="w-full pb-6 text-center text-xs text-mute hover:text-flame">
          Leave group
        </button>
      </div>
    </AppShell>
  );
}
