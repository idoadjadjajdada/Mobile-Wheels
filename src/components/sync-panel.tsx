"use client";

import { useEffect, useState } from "react";
import { pullAll, pushAll, sb, syncAvailable } from "@/lib/client/sync";
import { Button } from "./states";
import { useToast } from "./toast";

export function SyncPanel() {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = sb();
    if (!c) return;
    c.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
    const { data } = c.auth.onAuthStateChange((_e, session) => setUser(session?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!syncAvailable()) {
    return <p className="text-sm text-mute">Your preferences are saved on this device. Account sync turns on when this instance is connected to Supabase.</p>;
  }

  if (user) {
    return (
      <div className="glass space-y-3 rounded-2xl p-4 text-sm">
        <p>Signed in as <strong>{user}</strong></p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await pullAll();
                await pushAll();
                show({ message: "Preferences synced" });
              } catch (e) {
                show({ message: "Sync failed", detail: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="ghost" onClick={() => sb()?.auth.signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="glass space-y-3 rounded-2xl p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await sb()!.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/profile` } });
        setBusy(false);
        show(error ? { message: "Couldn't send link", detail: error.message } : { message: "Check your email", detail: "Tap the link to sign in." });
      }}
    >
      <p className="text-sm text-dust">Sign in to keep your taste profile across devices. No password — we email you a link.</p>
      <label className="sr-only" htmlFor="email">Email</label>
      <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm outline-none" />
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Email me a sign-in link"}</Button>
    </form>
  );
}
