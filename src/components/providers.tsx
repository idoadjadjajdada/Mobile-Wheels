"use client";

import { useEffect, type ReactNode } from "react";
import { ensureHydrated } from "@/lib/client/store";
import { ToastProvider } from "./toast";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureHydrated();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
