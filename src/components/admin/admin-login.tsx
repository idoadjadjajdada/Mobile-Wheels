"use client";

import { useState } from "react";
import { Button } from "../states";
import { SyncPanel } from "../sync-panel";
import { adminFetch } from "./admin-api";

export function AdminLogin({ reason, supabase, onDone }: { reason: string; supabase: boolean; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-sm space-y-4 px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">CRAVE Admin</h1>
      <p className="text-sm text-dust">{reason}</p>
      {supabase ? (
        <>
          <SyncPanel />
          <Button variant="ghost" className="w-full" onClick={onDone}>I&apos;ve signed in — continue</Button>
          <p className="text-xs text-mute">Admins are accounts with <code>profiles.role = &apos;admin&apos;</code> (set it in the Supabase SQL editor).</p>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await adminFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pw }) });
              onDone();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          <label className="sr-only" htmlFor="pw">Admin password</label>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" className="glass w-full rounded-xl px-3 py-3 outline-none" />
          <Button type="submit" className="w-full">Sign in</Button>
          {err && <p className="text-sm text-flame">{err}</p>}
        </form>
      )}
    </div>
  );
}
