"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { getState, preferenceSnapshot, useHydrated } from "@/lib/client/store";
import type { Offering } from "@/lib/types";

/** Fresh offering from the server (hours/links recomputed now), falling back to the saved copy offline. */
export function useOffering(key: string) {
  const hydrated = useHydrated();
  const [offering, setOffering] = useState<Offering | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const s = getState();
    api
      .offerings([key], s.profile.location?.point, preferenceSnapshot())
      .then(({ offerings }) => {
        if (cancelled) return;
        if (offerings[0]) setOffering(offerings[0]);
        else if (s.saved[key]) {
          setOffering(s.saved[key]);
          setStale(true);
        } else setError("This meal is no longer available.");
      })
      .catch((err) => {
        if (cancelled) return;
        if (s.saved[key]) {
          setOffering(s.saved[key]);
          setStale(true);
        } else setError(err instanceof ApiError ? err.message : "Couldn't load this meal.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, hydrated]);

  return { offering, stale, error, loading };
}
