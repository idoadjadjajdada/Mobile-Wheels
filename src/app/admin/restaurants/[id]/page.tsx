"use client";

import { Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/admin-api";
import { HoursEditor, type HoursDraft } from "@/components/admin/hours-editor";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/states";
import { CHAINS } from "@/lib/catalog/chains";
import { MARKETS } from "@/lib/catalog/markets";
import type { DataChange, StoredRestaurant } from "@/lib/db/repository";
import { FOOD_CATEGORIES, type DeliveryListing, type MenuItem } from "@/lib/types";

const LOCKABLE = ["name", "chainId", "kind", "address", "phone", "website", "cuisine", "hours", "pickup", "location"];
const PLATFORMS = [
  { id: "direct", label: "Direct (restaurant/chain site)" },
  { id: "doordash", label: "DoorDash" },
  { id: "ubereats", label: "Uber Eats" },
  { id: "grubhub", label: "Grubhub" },
] as const;

interface Detail {
  restaurant: StoredRestaurant;
  menu: MenuItem[];
  listings: DeliveryListing[];
  changes: DataChange[];
}

const emptyHours = (): HoursDraft => ({ regular: [], special: [] });

export default function AdminRestaurant() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<string, unknown> | null>(() =>
    isNew
      ? { name: "", marketId: "tucson", chainId: "", kind: "standard", hostRestaurantId: "", line1: "", city: "Tucson", state: "AZ", postalCode: "", lat: 32.2226, lng: -110.9747, phone: "", website: "", cuisine: "", pickup: "unknown", status: "active", priceLevel: "", cutoff: "" }
      : null,
  );
  const [general, setGeneral] = useState<HoursDraft>(emptyHours());
  const [delivery, setDelivery] = useState<HoursDraft | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<{ item: Partial<MenuItem>; n: number } | null>(null);
  const edit = (item: Partial<MenuItem>) => setEditing((e) => ({ item, n: (e?.n ?? 0) + 1 }));

  const apply = (det: Detail) => {
    const r = det.restaurant;
    setD(det);
    setForm({
      name: r.name, marketId: r.marketId, chainId: r.chainId ?? "", kind: r.kind, hostRestaurantId: r.hostRestaurantId ?? "",
      line1: r.address.line1 ?? "", city: r.address.city ?? "", state: r.address.state ?? "", postalCode: r.address.postalCode ?? "",
      lat: r.location.lat, lng: r.location.lng, phone: r.phone ?? "", website: r.website ?? "", cuisine: r.cuisine.join(", "),
      pickup: r.pickup, status: r.status, priceLevel: r.priceLevel ?? "", cutoff: r.hours.kitchenCutoffMinutes ?? "",
    });
    setGeneral(r.hours.general ? { regular: r.hours.general.regular, special: r.hours.general.special } : emptyHours());
    setDelivery(r.hours.delivery ? { regular: r.hours.delivery.regular, special: r.hours.delivery.special } : null);
    setLocked(r.lockedFields);
  };
  const load = () => (isNew ? Promise.resolve() : adminFetch<Detail>(`/api/admin/restaurants/${id}`).then(apply));

  useEffect(() => {
    if (isNew) return;
    adminFetch<Detail>(`/api/admin/restaurants/${id}`)
      .then(apply)
      .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, [id, isNew]);

  if (!form) return <div className="p-10 text-dust">{msg?.text ?? "Loading…"}</div>;
  const f = (k: string) => String(form[k] ?? "");
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  const save = async () => {
    setMsg(null);
    const body = {
      name: f("name"),
      marketId: f("marketId"),
      chainId: f("chainId") || null,
      kind: f("kind"),
      hostRestaurantId: f("hostRestaurantId") || null,
      address: { line1: f("line1") || undefined, city: f("city") || undefined, state: f("state") || undefined, postalCode: f("postalCode") || undefined },
      location: { lat: Number(form.lat), lng: Number(form.lng) },
      phone: f("phone") || undefined,
      website: f("website") || "",
      cuisine: f("cuisine").split(",").map((s) => s.trim()).filter(Boolean),
      priceLevel: form.priceLevel ? Number(form.priceLevel) : null,
      pickup: f("pickup"),
      status: f("status"),
      hours: {
        general: general.regular.length || general.special.length ? general : undefined,
        delivery: delivery && (delivery.regular.length || delivery.special.length) ? delivery : undefined,
        kitchenCutoffMinutes: form.cutoff !== "" ? Number(form.cutoff) : undefined,
      },
      lockedFields: isNew ? locked : locked,
      markVerified: true,
    };
    try {
      if (isNew) {
        const r = await adminFetch<StoredRestaurant>("/api/admin/restaurants", { method: "POST", body: JSON.stringify(body) });
        router.replace(`/admin/restaurants/${r.id}`);
      } else {
        await adminFetch(`/api/admin/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        await load();
        setMsg({ ok: true, text: "Saved. Edited fields are stamped manual/verified." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-sm text-mute hover:text-bone">← Admin</Link>
        {!isNew && <Link href={`/restaurant/${id}`} className="ml-auto text-sm text-dust underline">View in app</Link>}
      </div>
      <h1 className="font-display text-3xl font-semibold">{isNew ? "Add restaurant" : f("name")}</h1>
      {d && (
        <p className="text-xs text-mute">
          Source {d.restaurant.provenance.source}{d.restaurant.provenance.sourceRef ? ` (${d.restaurant.provenance.sourceRef})` : ""} · {d.restaurant.provenance.verification}
          {d.restaurant.provenance.verifiedAt ? ` ${new Date(d.restaurant.provenance.verifiedAt).toLocaleString()}` : ""} · refresh {d.restaurant.refreshStatus}
          {d.restaurant.lastRefreshedAt ? ` (last ${new Date(d.restaurant.lastRefreshedAt).toLocaleString()})` : ""}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input value={f("name")} onChange={(e) => set("name", e.target.value)} className={input} /></Field>
        <Field label="Market">
          <select value={f("marketId")} onChange={(e) => set("marketId", e.target.value)} className={input}>{MARKETS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Chain">
          <select value={f("chainId")} onChange={(e) => set("chainId", e.target.value)} className={input}>
            <option value="">Independent</option>
            {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Kind">
          <select value={f("kind")} onChange={(e) => set("kind", e.target.value)} className={input}>
            <option value="standard">Standard</option><option value="virtual_brand">Virtual brand</option><option value="ghost_kitchen">Ghost kitchen</option><option value="delivery_only">Delivery only</option>
          </select>
        </Field>
        {f("kind") !== "standard" && <Field label="Host restaurant id (kitchen it operates from)"><input value={f("hostRestaurantId")} onChange={(e) => set("hostRestaurantId", e.target.value)} className={input} /></Field>}
        <Field label="Street"><input value={f("line1")} onChange={(e) => set("line1", e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City"><input value={f("city")} onChange={(e) => set("city", e.target.value)} className={input} /></Field>
          <Field label="State"><input value={f("state")} onChange={(e) => set("state", e.target.value)} className={input} /></Field>
          <Field label="ZIP"><input value={f("postalCode")} onChange={(e) => set("postalCode", e.target.value)} className={input} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude"><input type="number" step="any" value={f("lat")} onChange={(e) => set("lat", e.target.value)} className={input} /></Field>
          <Field label="Longitude"><input type="number" step="any" value={f("lng")} onChange={(e) => set("lng", e.target.value)} className={input} /></Field>
        </div>
        <Field label="Phone"><input value={f("phone")} onChange={(e) => set("phone", e.target.value)} className={input} /></Field>
        <Field label="Website (https://)"><input value={f("website")} onChange={(e) => set("website", e.target.value)} className={input} /></Field>
        <Field label="Cuisine (comma separated)"><input value={f("cuisine")} onChange={(e) => set("cuisine", e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Pickup">
            <select value={f("pickup")} onChange={(e) => set("pickup", e.target.value)} className={input}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
          </Field>
          <Field label="Price level">
            <select value={f("priceLevel")} onChange={(e) => set("priceLevel", e.target.value)} className={input}><option value="">—</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{"$".repeat(n)}</option>)}</select>
          </Field>
          <Field label="Status">
            <select value={f("status")} onChange={(e) => set("status", e.target.value)} className={input}><option value="active">Active</option><option value="hidden">Hidden</option><option value="closed_permanently">Closed permanently</option></select>
          </Field>
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-display text-xl font-semibold">Hours</h2>
        <p className="mb-3 text-xs text-mute">Times are local to the market ({MARKETS.find((m) => m.id === f("marketId"))?.timezone}). Published hours only — never a claim that delivery apps are accepting orders.</p>
        <HoursEditor value={general} onChange={setGeneral} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Kitchen cutoff (min before close)"><input type="number" min={0} max={180} value={f("cutoff")} onChange={(e) => set("cutoff", e.target.value)} className={input} /></Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!delivery} onChange={(e) => setDelivery(e.target.checked ? { regular: general.regular, special: [] } : null)} /> Separate delivery hours
        </label>
        {delivery && <div className="mt-3"><HoursEditor value={delivery} onChange={setDelivery} /></div>}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" /> Locked from automated refresh</h2>
        <div className="flex flex-wrap gap-2">
          {LOCKABLE.map((k) => (
            <button key={k} onClick={() => setLocked((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))} aria-pressed={locked.includes(k)} className={`rounded-full px-3 py-1 text-xs ${locked.includes(k) ? "bg-sky/20 text-sky" : "glass text-mute"}`}>
              {k}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save}>{isNew ? "Create restaurant" : "Save changes"}</Button>
        {!isNew && <Button variant="danger" onClick={async () => { await adminFetch(`/api/admin/restaurants/${id}`, { method: "DELETE" }); router.push("/admin"); }}><Trash2 className="h-4 w-4" /> Hide</Button>}
        {msg && <span className={`text-sm ${msg.ok ? "text-sage" : "text-flame"}`}>{msg.text}</span>}
      </div>

      {d && (
        <>
          <section>
            <h2 className="mb-1 font-display text-xl font-semibold">Ordering platforms</h2>
            <p className="mb-3 text-xs text-mute">Record what you verified by hand: whether the store appears on the platform and its exact store URL. This never claims address coverage or live availability.</p>
            <div className="space-y-2">{PLATFORMS.map((p) => <ListingRow key={p.id} restaurantId={id} platform={p.id} label={p.label} current={d.listings.find((l) => l.platform === p.id)} onSaved={load} />)}</div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Menu</h2>
              <Button variant="ghost" onClick={() => edit({ restaurantId: id, category: "burgers", price: { currency: "USD", status: "unknown", source: "manual" }, portion: { size: "regular" }, ingredients: [], dietary: [], isCombo: false, available: true })}>Add item</Button>
            </div>
            <ul className="space-y-1.5">
              {d.menu.map((m) => (
                <li key={m.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-mute">{m.restaurantId ? "this location" : `chain: ${m.chainId}`} · {m.category}</span>
                  </span>
                  <span className="text-xs text-dust">{m.price.amount != null ? `$${m.price.amount}` : m.price.low != null ? `$${m.price.low}–${m.price.high}` : "—"} · {m.price.status}</span>
                  {m.restaurantId ? (
                    <button onClick={() => edit(m)} className="rounded-full bg-white/8 px-3 py-1 text-xs">Edit</button>
                  ) : (
                    <>
                      <button onClick={() => edit({ ...m, id: undefined, chainId: undefined, restaurantId: id })} className="rounded-full bg-white/8 px-3 py-1 text-xs">Verify price here</button>
                      <button onClick={() => edit(m)} className="rounded-full bg-white/5 px-3 py-1 text-xs text-mute">Edit chain item</button>
                    </>
                  )}
                </li>
              ))}
              {!d.menu.length && <p className="text-sm text-mute">No menu items. Add the restaurant&apos;s real items with verified prices.</p>}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold">Recent changes</h2>
            <ul className="space-y-1 font-mono text-[11px] text-mute">
              {d.changes.map((c) => <li key={c.id}>{new Date(c.detectedAt).toLocaleString()} · {c.source} · {c.changeType} {c.field ?? ""}</li>)}
              {!d.changes.length && <li>None</li>}
            </ul>
          </section>
        </>
      )}

      {editing && <MenuItemSheet key={editing.n} item={editing.item} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

const input = "w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm outline-none focus:bg-white/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-mute">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ListingRow({ restaurantId, platform, label, current, onSaved }: { restaurantId: string; platform: string; label: string; current?: DeliveryListing; onSaved: () => void }) {
  const [status, setStatus] = useState(current?.listingStatus ?? "unknown");
  const [url, setUrl] = useState(current?.storeUrl ?? "");
  const [del, setDel] = useState(current?.offersDelivery ?? "unknown");
  const [pick, setPick] = useState(current?.offersPickup ?? "unknown");
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/listings`, { method: "PUT", body: JSON.stringify({ platform, listingStatus: status, storeUrl: url, offersDelivery: del, offersPickup: pick }) });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="glass rounded-2xl p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-44 font-medium">{label}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg bg-white/5 px-2 py-1.5 text-xs" aria-label={`${label} listing status`}>
          <option value="unknown">Unknown</option><option value="verified_listed">Verified listed</option><option value="reported_listed">Reported listed</option><option value="not_listed">Verified NOT listed</option>
        </select>
        <select value={del} onChange={(e) => setDel(e.target.value as typeof del)} className="rounded-lg bg-white/5 px-2 py-1.5 text-xs" aria-label="Offers delivery"><option value="unknown">Delivery ?</option><option value="yes">Delivery yes</option><option value="no">Delivery no</option></select>
        <select value={pick} onChange={(e) => setPick(e.target.value as typeof pick)} className="rounded-lg bg-white/5 px-2 py-1.5 text-xs" aria-label="Offers pickup"><option value="unknown">Pickup ?</option><option value="yes">Pickup yes</option><option value="no">Pickup no</option></select>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… exact store URL" className="min-w-0 flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs" aria-label={`${label} store URL`} />
        <button onClick={save} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">Save</button>
        {current && <button onClick={async () => { await adminFetch(`/api/admin/restaurants/${restaurantId}/listings?platform=${platform}`, { method: "DELETE" }); onSaved(); }} className="p-1 text-mute hover:text-flame" aria-label="Remove listing"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      {current?.provenance.verifiedAt && <p className="mt-1 text-[11px] text-mute">Last verified {new Date(current.provenance.verifiedAt).toLocaleString()} by {current.provenance.verifiedBy ?? "admin"}</p>}
      {err && <p className="mt-1 text-xs text-flame">{err}</p>}
    </div>
  );
}

/** Remounted (via key) for each item being edited, so local state starts from the item. */
function MenuItemSheet({ item, onClose, onSaved }: { item: Partial<MenuItem>; onClose: () => void; onSaved: () => void }) {
  const [m, setM] = useState<Partial<MenuItem>>(item);
  const [err, setErr] = useState<string | null>(null);
  const price = m.price ?? { currency: "USD" as const, status: "unknown" as const, source: "manual" as const };
  const save = async () => {
    setErr(null);
    try {
      await adminFetch("/api/admin/menu-items", {
        method: "POST",
        body: JSON.stringify({
          id: m.id,
          chainId: m.chainId,
          restaurantId: m.restaurantId,
          name: m.name ?? "",
          description: m.description || undefined,
          category: m.category,
          ingredients: m.ingredients ?? [],
          price: { amount: price.amount, low: price.low, high: price.high, status: price.status, channel: price.channel },
          isCombo: !!m.isCombo,
          portion: m.portion ?? { size: "regular" },
          calories: m.nutrition?.calories,
          allergens: m.allergens ? { contains: m.allergens.contains, verified: m.allergens.provenance.verification === "verified" } : undefined,
          dietary: m.dietary ?? [],
          image: m.image?.url ? m.image : undefined,
          orderPath: m.orderPath ?? "",
          available: m.available !== false,
        }),
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const num = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <Sheet open onClose={onClose} title={m.id ? "Edit menu item" : "New menu item"}>
      <div className="space-y-3">
        <Field label="Name"><input value={m.name ?? ""} onChange={(e) => setM({ ...m, name: e.target.value })} className={input} /></Field>
        <Field label="Description"><textarea value={m.description ?? ""} onChange={(e) => setM({ ...m, description: e.target.value })} rows={2} className={input} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category"><select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value as MenuItem["category"] })} className={input}>{FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Portion"><select value={m.portion?.size ?? "regular"} onChange={(e) => setM({ ...m, portion: { size: e.target.value as MenuItem["portion"]["size"] } })} className={input}>{["snack", "regular", "large", "shareable"].map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Ingredients (comma separated)"><input value={(m.ingredients ?? []).join(", ")} onChange={(e) => setM({ ...m, ingredients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={input} /></Field>
        <div className="rounded-2xl bg-white/[0.03] p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price status">
              <select value={price.status} onChange={(e) => setM({ ...m, price: { ...price, status: e.target.value as MenuItem["price"]["status"] } })} className={input}>
                <option value="verified">Verified (exact, checked today)</option><option value="reported">Reported</option><option value="estimate">Estimate (range)</option><option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Channel observed">
              <select value={price.channel ?? ""} onChange={(e) => setM({ ...m, price: { ...price, channel: (e.target.value || undefined) as MenuItem["price"]["channel"] } })} className={input}>
                <option value="">—</option><option value="in_store">In store</option><option value="direct_online">Direct online</option><option value="doordash">DoorDash</option><option value="ubereats">Uber Eats</option><option value="grubhub">Grubhub</option>
              </select>
            </Field>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Field label="Exact $"><input type="number" step="0.01" value={price.amount ?? ""} onChange={(e) => setM({ ...m, price: { ...price, amount: num(e.target.value) } })} className={input} /></Field>
            <Field label="Low $"><input type="number" step="0.01" value={price.low ?? ""} onChange={(e) => setM({ ...m, price: { ...price, low: num(e.target.value) } })} className={input} /></Field>
            <Field label="High $"><input type="number" step="0.01" value={price.high ?? ""} onChange={(e) => setM({ ...m, price: { ...price, high: num(e.target.value) } })} className={input} /></Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calories"><input type="number" value={m.nutrition?.calories ?? ""} onChange={(e) => setM({ ...m, nutrition: e.target.value ? { calories: Number(e.target.value), provenance: { source: "manual", verification: "verified" } } : undefined })} className={input} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={!!m.isCombo} onChange={(e) => setM({ ...m, isCombo: e.target.checked })} /> Is a combo/meal</label>
        </div>
        <Field label="Allergens (comma separated, leave empty if unknown)">
          <input value={(m.allergens?.contains ?? []).join(", ")} onChange={(e) => { const contains = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); setM({ ...m, allergens: contains.length ? { contains, provenance: { source: "manual", verification: m.allergens?.provenance.verification ?? "reported" } } : undefined }); }} className={input} />
        </Field>
        {m.allergens && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.allergens.provenance.verification === "verified"} onChange={(e) => setM({ ...m, allergens: { ...m.allergens!, provenance: { source: "manual", verification: e.target.checked ? "verified" : "reported" } } })} /> Allergen list verified against the restaurant&apos;s official allergen guide</label>
        )}
        <Field label="Image URL (https, official or licensed only)"><input value={m.image?.url ?? ""} onChange={(e) => setM({ ...m, image: e.target.value ? { url: e.target.value, kind: m.image?.kind ?? "official", attribution: m.image?.attribution } : undefined })} className={input} /></Field>
        {m.image && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Image kind"><select value={m.image.kind} onChange={(e) => setM({ ...m, image: { ...m.image!, kind: e.target.value as "official" } })} className={input}><option value="official">Official</option><option value="licensed">Licensed</option><option value="representative">Representative</option></select></Field>
            <Field label="Attribution"><input value={m.image.attribution ?? ""} onChange={(e) => setM({ ...m, image: { ...m.image!, attribution: e.target.value || undefined } })} className={input} /></Field>
          </div>
        )}
        <Field label="Deep link to this item (https, optional)"><input value={m.orderPath ?? ""} onChange={(e) => setM({ ...m, orderPath: e.target.value })} className={input} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.available !== false} onChange={(e) => setM({ ...m, available: e.target.checked })} /> Available</label>
        {err && <p className="text-sm text-flame">{err}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save}>Save item</Button>
          {m.id && m.restaurantId && <Button variant="danger" onClick={async () => { await adminFetch(`/api/admin/menu-items?id=${encodeURIComponent(m.id!)}`, { method: "DELETE" }); onSaved(); }}>Delete</Button>}
        </div>
      </div>
    </Sheet>
  );
}
