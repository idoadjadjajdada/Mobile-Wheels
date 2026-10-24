"use client";

import { Database, Flag, ListChecks, LogOut, Plus, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, AdminError } from "@/components/admin/admin-api";
import { AdminLogin } from "@/components/admin/admin-login";
import { Wordmark } from "@/components/shell";
import { Button } from "@/components/states";
import type { DataChange, RefreshRun, StoredRestaurant, UserReport } from "@/lib/db/repository";
import type { ProviderInfo } from "@/lib/providers/types";

interface Overview {
  admin: string;
  store: "supabase" | "local";
  totals: { restaurants: number; chainLocations: number; independents: number; virtual: number; manuallyVerified: number; byStatus: Record<string, number> };
  coverage: { id: string; name: string; tier: string; locations: number }[];
  runs: RefreshRun[];
  unreviewedChanges: number;
  openReports: number;
  providers: (ProviderInfo & { capabilities?: Record<string, boolean> })[];
}

type Tab = "overview" | "restaurants" | "changes" | "reports" | "sources";

export default function AdminPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [auth, setAuth] = useState<{ reason: string } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [supabase, setSupabase] = useState(false);

  const load = useCallback(
    () =>
      adminFetch<Overview>("/api/admin/overview")
        .then((o) => {
          setOv(o);
          setAuth(null);
        })
        .catch((e) => setAuth({ reason: e instanceof AdminError ? e.message : (e as Error).message })),
    [],
  );

  useEffect(() => {
    void load();
    fetch("/api/status").then((r) => r.json()).then((s) => setSupabase(!!s.auth)).catch(() => undefined);
  }, [load]);

  if (auth) return <AdminLogin reason={auth.reason} supabase={supabase} onDone={load} />;
  if (!ov) return <div className="p-10 text-dust">Loading admin…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wordmark className="text-3xl" />
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-dust">Admin</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-dust">
          {ov.admin}
          <button onClick={async () => { await adminFetch("/api/admin/logout", { method: "POST" }); location.reload(); }} className="glass rounded-full p-2" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {ov.store === "local" && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-honey/12 p-4 text-sm text-honey">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <p>Local development store (JSON file). Data won&apos;t persist on serverless hosting. Configure Supabase (see README) for production.</p>
        </div>
      )}

      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" role="tablist">
        {([
          ["overview", "Overview", Database],
          ["restaurants", "Restaurants", Search],
          ["changes", `Changes${ov.unreviewedChanges ? ` (${ov.unreviewedChanges})` : ""}`, ListChecks],
          ["reports", `Reports${ov.openReports ? ` (${ov.openReports})` : ""}`, Flag],
          ["sources", "Data sources", ShieldCheck],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${tab === id ? "bg-bone text-ink" : "glass text-dust"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab ov={ov} reload={load} />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "changes" && <ChangesTab onChange={load} />}
        {tab === "reports" && <ReportsTab onChange={load} />}
        {tab === "sources" && <SourcesTab providers={ov.providers} />}
      </div>
    </div>
  );
}

function OverviewTab({ ov, reload }: { ov: Overview; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (brandsOnly: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminFetch<{ status: string; stats: Record<string, number>; error?: string }>("/api/admin/refresh", { method: "POST", body: JSON.stringify({ marketId: "tucson", source: "osm", brandsOnly }) });
      setMsg(`${r.status}: ${Object.entries(r.stats).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ")}${r.error ? ` — ${r.error}` : ""}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      reload();
    }
  };
  const t = ov.totals;
  const national = ov.coverage.filter((c) => c.tier === "national");
  const regional = ov.coverage.filter((c) => c.tier !== "national");
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Restaurants", t.restaurants], ["Chain locations", t.chainLocations], ["Independents", t.independents], ["Virtual / ghost", t.virtual], ["Manually verified", t.manuallyVerified]].map(([l, n]) => (
          <div key={l} className="glass rounded-2xl p-4">
            <div className="font-display text-3xl font-semibold">{n}</div>
            <div className="text-xs text-mute">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(t.byStatus).map(([k, v]) => <span key={k} className="rounded-full bg-white/6 px-3 py-1 text-dust">{k}: {v}</span>)}
      </div>

      <section className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Refresh Tucson from OpenStreetMap</h2>
            <p className="text-sm text-dust">Rate-limited, with change detection. Locked fields and manual edits are never overwritten.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => run(true)}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Chains only</Button>
            <Button disabled={busy} onClick={() => run(false)}>Full refresh</Button>
          </div>
        </div>
        {msg && <p className="mt-3 rounded-xl bg-white/5 p-3 font-mono text-xs text-dust">{msg}</p>}
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs text-mute"><tr><th className="py-1">Started</th><th>Source</th><th>Trigger</th><th>Status</th><th>Stats</th></tr></thead>
          <tbody>
            {ov.runs.map((r) => (
              <tr key={r.id} className="border-t border-white/5 align-top">
                <td className="py-2 pr-3 text-dust">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="pr-3">{r.source}</td>
                <td className="pr-3">{r.trigger}</td>
                <td className={`pr-3 ${r.status === "succeeded" ? "text-sage" : r.status === "running" ? "text-honey" : "text-flame"}`}>{r.status}</td>
                <td className="font-mono text-[11px] text-mute">{Object.entries(r.stats).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(" ")}{r.error ? ` · ${r.error}` : ""}</td>
              </tr>
            ))}
            {!ov.runs.length && <tr><td colSpan={5} className="py-3 text-mute">No refresh has run yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Chain coverage (priority order)</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...national, ...regional].map((c) => (
            <div key={c.id} className="glass flex items-center justify-between rounded-xl px-3 py-2 text-sm">
              <span>{c.name} <span className="text-[10px] uppercase text-mute">{c.tier}</span></span>
              <span className={c.locations ? "text-bone" : "text-flame"}>{c.locations}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RestaurantsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<{ rows: StoredRestaurant[]; total: number } | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      adminFetch<{ rows: StoredRestaurant[]; total: number }>(`/api/admin/restaurants?q=${encodeURIComponent(q)}&status=${status}&offset=${offset}`).then(setData).catch(() => setData({ rows: [], total: 0 }));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, offset]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Search name or address" className="glass min-w-0 flex-1 rounded-xl px-3 py-2.5 outline-none" aria-label="Search restaurants" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className="glass rounded-xl px-3 py-2.5" aria-label="Refresh status">
          <option value="">Any status</option>
          {["fresh", "stale", "pending", "failed", "manual_only"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Link href="/admin/restaurants/new" className="ember-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add restaurant</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white/[0.03]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-mute"><tr><th className="p-3">Name</th><th>Chain</th><th>Kind</th><th>Address</th><th>Source</th><th>Refresh</th><th>Hours</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-3"><Link href={`/admin/restaurants/${r.id}`} className="font-medium underline-offset-2 hover:underline">{r.name}</Link>{r.status !== "active" && <span className="ml-2 text-xs text-flame">{r.status}</span>}</td>
                <td className="pr-3 text-dust">{r.chainId ?? "—"}</td>
                <td className="pr-3 text-dust">{r.kind}</td>
                <td className="pr-3 text-dust">{r.address.line1 ?? "—"}</td>
                <td className="pr-3 text-xs">{r.provenance.source} · {r.provenance.verification}</td>
                <td className={`pr-3 text-xs ${r.refreshStatus === "stale" ? "text-honey" : "text-dust"}`}>{r.refreshStatus}</td>
                <td className="pr-3 text-xs text-dust">{r.hours.general?.regular.length ? "✓" : "missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.rows.length && <p className="p-4 text-sm text-mute">No restaurants. Run a refresh from the Overview tab, or add one manually.</p>}
      </div>
      {data && data.total > 50 && (
        <div className="flex items-center justify-between text-sm text-dust">
          <span>{offset + 1}–{Math.min(offset + 50, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Prev</Button>
            <Button variant="ghost" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangesTab({ onChange }: { onChange: () => void }) {
  const [changes, setChanges] = useState<DataChange[] | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const load = useCallback(() => adminFetch<{ changes: DataChange[] }>("/api/admin/changes").then((r) => setChanges(r.changes)), []);
  useEffect(() => void load(), [load]);
  const review = async (ids: number[]) => {
    await adminFetch("/api/admin/changes", { method: "POST", body: JSON.stringify({ ids }) });
    setSel([]);
    await load();
    onChange();
  };
  if (!changes) return <p className="text-dust">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="ghost" disabled={!sel.length} onClick={() => review(sel)}>Mark {sel.length || ""} reviewed</Button>
        <Button variant="ghost" disabled={!changes.length} onClick={() => review(changes.map((c) => c.id!).filter(Boolean))}>Mark all reviewed</Button>
      </div>
      {!changes.length && <p className="text-sm text-mute">No unreviewed changes.</p>}
      <ul className="space-y-1.5">
        {changes.map((c) => (
          <li key={c.id} className="glass flex items-start gap-3 rounded-xl p-3 text-sm">
            <input type="checkbox" checked={sel.includes(c.id!)} onChange={() => setSel((s) => (s.includes(c.id!) ? s.filter((x) => x !== c.id) : [...s, c.id!]))} aria-label="Select change" className="mt-1" />
            <div className="min-w-0 flex-1">
              <div>
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.changeType === "removed" ? "bg-flame/15 text-flame" : c.changeType === "skipped_locked" ? "bg-sky/15 text-sky" : c.changeType === "created" ? "bg-sage/15 text-sage" : "bg-honey/15 text-honey"}`}>{c.changeType}</span>
                {c.entityType === "restaurant" ? <Link href={`/admin/restaurants/${c.entityId}`} className="underline">{c.entityType}</Link> : c.entityType} {c.field && <code className="text-dust">{c.field}</code>}
                <span className="ml-2 text-xs text-mute">{c.source} · {new Date(c.detectedAt).toLocaleString()}</span>
              </div>
              {(c.oldValue !== undefined || c.newValue !== undefined) && (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-mute">
                  {c.oldValue !== undefined && `− ${JSON.stringify(c.oldValue)}\n`}
                  {c.newValue !== undefined && `+ ${JSON.stringify(c.newValue)}`}
                </pre>
              )}
              {c.entityType === "chain" && c.field === "wikidata" && <p className="mt-1 text-xs text-honey">Suggested brand:wikidata seen in OSM. Verify it, then add it to src/lib/catalog/chains.ts and re-seed.</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportsTab({ onChange }: { onChange: () => void }) {
  const [reports, setReports] = useState<UserReport[] | null>(null);
  const load = useCallback(() => adminFetch<{ reports: UserReport[] }>("/api/admin/reports").then((r) => setReports(r.reports)), []);
  useEffect(() => void load(), [load]);
  const set = async (id: string, status: UserReport["status"]) => {
    await adminFetch("/api/admin/reports", { method: "PATCH", body: JSON.stringify({ id, status }) });
    await load();
    onChange();
  };
  if (!reports) return <p className="text-dust">Loading…</p>;
  if (!reports.length) return <p className="text-sm text-mute">No reports from users yet.</p>;
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li key={r.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${r.status === "open" ? "bg-honey/15 text-honey" : "bg-white/8 text-mute"}`}>{r.status}</span>
          <span className="font-medium">{r.kind}</span>
          <span className="min-w-0 flex-1 text-dust">{r.message ?? "—"}</span>
          {r.restaurantId && <Link href={`/admin/restaurants/${r.restaurantId}`} className="text-xs underline">Open restaurant</Link>}
          <span className="text-xs text-mute">{new Date(r.createdAt).toLocaleString()}</span>
          {r.status === "open" && (
            <>
              <button onClick={() => set(r.id, "resolved")} className="rounded-full bg-sage/15 px-3 py-1 text-xs text-sage">Resolved</button>
              <button onClick={() => set(r.id, "dismissed")} className="rounded-full bg-white/8 px-3 py-1 text-xs">Dismiss</button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function SourcesTab({ providers }: { providers: Overview["providers"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {providers.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-4 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{p.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.disabledReason ? "bg-flame/15 text-flame" : p.configured ? "bg-sage/15 text-sage" : "bg-white/8 text-mute"}`}>
              {p.disabledReason ? "disabled" : p.configured ? "active" : "not configured"}
            </span>
          </div>
          <p className="mt-1 text-xs text-mute">{p.kinds.join(" · ")}{p.requires.length ? ` · needs ${p.requires.join(", ")}` : " · no key needed"}</p>
          <p className="mt-2 text-dust">{p.licensing}</p>
          <p className="mt-1 text-xs text-mute">Cost: {p.cost}</p>
          {p.capabilities && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(p.capabilities).map(([k, v]) => (
                <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] ${v ? "bg-sage/15 text-sage" : "bg-white/5 text-mute line-through"}`}>{k}</span>
              ))}
            </div>
          )}
          {p.disabledReason && <p className="mt-2 text-xs text-flame">{p.disabledReason}</p>}
          {p.docsUrl && <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">Docs</a>}
        </div>
      ))}
    </div>
  );
}
