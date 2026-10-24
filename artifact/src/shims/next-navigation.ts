import { useMemo } from "react";
import { back, matchRoute, navigate, useHref } from "../router";

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, true),
  back,
  forward: () => undefined,
  refresh: () => undefined,
  prefetch: () => undefined,
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return useHref().split("?")[0];
}

export function useSearchParams() {
  const q = useHref().split("?")[1] ?? "";
  return useMemo(() => new URLSearchParams(q), [q]);
}

export function useParams<T extends Record<string, string>>(): T {
  const path = usePathname();
  return useMemo(() => (matchRoute(path)?.params ?? {}) as T, [path]);
}

export function redirect(href: string) {
  navigate(href, true);
}

export function notFound() {
  navigate("/discover", true);
}
