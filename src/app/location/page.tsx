"use client";

import { LocateFixed, MapPin, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/states";
import { api, ApiError } from "@/lib/client/api";
import { updateProfile, useStore } from "@/lib/client/store";
import { MARKETS, marketForPoint } from "@/lib/catalog/markets";
import type { LatLng } from "@/lib/types";

export default function LocationPage() {
  const router = useRouter();
  const current = useStore((s) => s.profile.location);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"geo" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; point: LatLng; precision: string }[]>([]);

  const save = (label: string, point: LatLng, source: "geolocation" | "address", precision: "exact" | "approximate") => {
    updateProfile({ location: { label, point, source, precision } });
    router.push("/discover");
  };

  const useGeo = () => {
    setError(null);
    if (!("geolocation" in navigator)) return setError("Your browser doesn't support location. Enter an address instead.");
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let label = "Current location";
        try {
          label = (await api.reverse(point)).label ?? label;
        } catch {
          // keep generic label
        }
        setBusy(null);
        save(label, point, "geolocation", pos.coords.accuracy < 200 ? "exact" : "approximate");
      },
      (err) => {
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? "Location permission was denied. You can enter an address instead." : "Couldn't get your location. Try entering an address.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setBusy("search");
    try {
      const { results } = await api.geocode(q);
      if (!results.length) setError("No match. Try a full street address, e.g. “1000 E University Blvd, Tucson, AZ”.");
      setResults(results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Address lookup failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-10 pt-[calc(16px+var(--safe-top))]">
      <PageHeader title="Where should food go?" back={current ? "/discover" : undefined} />
      <p className="mt-3 text-sm text-dust">
        CRAVE is live in <strong className="text-bone">{MARKETS.filter((m) => m.active).map((m) => m.name).join(", ")}</strong>. More cities are on the way.
      </p>

      <Button onClick={useGeo} disabled={busy !== null} className="mt-6 w-full py-4">
        <LocateFixed className="h-5 w-5" /> {busy === "geo" ? "Finding you…" : "Use my current location"}
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-mute">
        <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={search} className="glass flex items-center gap-2 rounded-2xl p-1.5 pl-4">
        <Search className="h-4 w-4 text-mute" />
        <label htmlFor="addr" className="sr-only">
          Delivery address
        </label>
        <input
          id="addr"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Street address, city"
          autoComplete="street-address"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-mute"
        />
        <Button type="submit" variant="ghost" disabled={q.trim().length < 4 || busy !== null} className="py-2.5">
          {busy === "search" ? "…" : "Find"}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-flame" role="alert">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((r) => {
            const supported = !!marketForPoint(r.point.lat, r.point.lng);
            return (
              <li key={r.label}>
                <button onClick={() => save(r.label, r.point, "address", r.precision === "approximate" ? "approximate" : "exact")} className="glass flex w-full items-start gap-3 rounded-2xl p-4 text-left hover:bg-white/10">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{r.label}</span>
                    {!supported && <span className="mt-1 block text-xs text-honey">Outside our current area — you&apos;ll see a notice instead of results.</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 flex gap-3 rounded-2xl bg-white/[0.03] p-4 text-xs leading-relaxed text-dust">
        <ShieldCheck className="h-5 w-5 shrink-0 text-sage" />
        <p>
          Your location stays on this device and is only sent to CRAVE&apos;s server to find nearby restaurants. We don&apos;t sell it or share it with delivery apps — when you tap Order, you go to their site directly.
        </p>
      </div>

      <button onClick={() => { updateProfile({ demoMode: true }); router.push("/discover"); }} className="mt-6 w-full text-center text-xs text-mute underline-offset-4 hover:text-dust hover:underline">
        Just exploring? Try demo mode (fictional restaurants)
      </button>
    </div>
  );
}
