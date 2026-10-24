import { useSyncExternalStore } from "react";

/**
 * In-memory router for the single-page preview. Artifact frames don't expose
 * path or `#/path` URLs to the viewer, so history lives here instead.
 */

export const ROUTES = [
  "/",
  "/onboarding",
  "/location",
  "/discover",
  "/filters",
  "/likes",
  "/compare",
  "/profile",
  "/group",
  "/group/[code]",
  "/about",
  "/item/[key]",
  "/order/[key]",
  "/restaurant/[id]",
] as const;
export type RoutePattern = (typeof ROUTES)[number];

let stack: string[] = ["/"];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function navigate(href: string, replace = false) {
  stack = replace ? [...stack.slice(0, -1), href] : [...stack, href].slice(-50);
  window.scrollTo(0, 0);
  emit();
}

export function back() {
  stack = stack.length > 1 ? stack.slice(0, -1) : ["/discover"];
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useHref() {
  return useSyncExternalStore(
    subscribe,
    () => stack[stack.length - 1],
    () => "/",
  );
}

export function matchRoute(path: string): { pattern: RoutePattern; params: Record<string, string> } | null {
  const parts = path.split("/").filter(Boolean);
  for (const pattern of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pp.every((seg, i) => (seg.startsWith("[") ? ((params[seg.slice(1, -1)] = parts[i]), true) : seg === parts[i]))) return { pattern, params };
  }
  return null;
}
