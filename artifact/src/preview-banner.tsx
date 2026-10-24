import { useStore } from "@/lib/client/store";
import { navigate } from "./router";

export function PreviewBanner() {
  const located = useStore((s) => !!s.profile.location);
  const demo = useStore((s) => s.profile.demoMode);
  if (!located || demo) return null;
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 bg-honey/12 px-4 py-1.5 text-center text-[11px] text-honey">
      <span>Preview: real chain menus with estimated prices. No branch locations or hours.</span>
      <button onClick={() => navigate("/location")} className="font-semibold underline underline-offset-2">Switch</button>
    </div>
  );
}
