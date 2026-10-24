"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Wordmark } from "@/components/shell";
import { useHydrated, useStore } from "@/lib/client/store";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.profile.onboarded);
  const located = useStore((s) => !!s.profile.location || s.profile.demoMode);
  useEffect(() => {
    if (!hydrated) return;
    router.replace(!onboarded ? "/onboarding" : !located ? "/location" : "/discover");
  }, [hydrated, onboarded, located, router]);
  return (
    <div className="grid min-h-dvh place-items-center">
      <Wordmark className="animate-pulse text-6xl" />
    </div>
  );
}
