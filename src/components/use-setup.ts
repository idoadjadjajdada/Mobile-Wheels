"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useStore } from "@/lib/client/store";

/** Send people through onboarding → location before screens that need them. */
export function useRequireSetup(opts: { location?: boolean } = { location: true }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.profile.onboarded);
  const hasLocation = useStore((s) => !!s.profile.location || s.profile.demoMode);
  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded) router.replace("/onboarding");
    else if (opts.location !== false && !hasLocation) router.replace("/location");
  }, [hydrated, onboarded, hasLocation, router, opts.location]);
  return hydrated && onboarded && (opts.location === false || hasLocation);
}
