import { error, json, parseBody } from "@/lib/api";
import { restaurantInput } from "@/lib/admin-schemas";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";
import type { DataChange, StoredRestaurant } from "@/lib/db/repository";

type Ctx = RouteContext<"/api/admin/restaurants/[id]">;

export const GET = withAdmin<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  const r = await repo.getRestaurant(id);
  if (!r) return error(404, "Not found");
  const [menus, listings] = await Promise.all([repo.menuFor([r]), repo.listingsFor([id])]);
  const changes = (await repo.listChanges({ limit: 500 })).filter((c) => c.entityId === id).slice(0, 30);
  return json({ restaurant: r, menu: menus.get(id) ?? [], listings: listings.get(id) ?? [], changes });
});

/** Correct a restaurant. Edited fields are stamped manual/verified and (by default) locked from automated refresh. */
export const PATCH = withAdmin<Ctx>(async (req, ctx, admin) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  const current = await repo.getRestaurant(id);
  if (!current) return error(404, "Not found");
  const body = await parseBody(req, restaurantInput);
  if (!body.ok) return body.res;
  const d = body.data;
  const now = new Date().toISOString();
  const prov = { source: "manual" as const, verification: "verified" as const, verifiedAt: now, verifiedBy: admin.by };

  const next: StoredRestaurant = {
    ...current,
    name: d.name,
    chainId: d.chainId ?? undefined,
    kind: d.kind,
    hostRestaurantId: d.hostRestaurantId ?? undefined,
    address: d.address,
    location: d.location,
    phone: d.phone || undefined,
    website: d.website || undefined,
    cuisine: d.cuisine,
    priceLevel: (d.priceLevel ?? undefined) as StoredRestaurant["priceLevel"],
    pickup: d.pickup,
    status: d.status,
    hours: d.hours
      ? {
          general: d.hours.general ? { ...d.hours.general, raw: undefined, provenance: prov } : current.hours.general,
          delivery: d.hours.delivery ? { ...d.hours.delivery, provenance: prov } : undefined,
          pickup: d.hours.pickup ? { ...d.hours.pickup, provenance: prov } : undefined,
          kitchenCutoffMinutes: d.hours.kitchenCutoffMinutes,
        }
      : current.hours,
  };

  const fields = ["name", "chainId", "kind", "address", "phone", "website", "cuisine", "pickup", "status", "hours", "location"] as const;
  const changed = fields.filter((f) => JSON.stringify(current[f] ?? null) !== JSON.stringify(next[f] ?? null));
  next.lockedFields = d.lockedFields ?? [...new Set([...current.lockedFields, ...changed.filter((f) => f !== "status")])];
  if (d.markVerified || changed.length) next.provenance = { ...current.provenance, verification: "verified", verifiedAt: now, verifiedBy: admin.by };

  const saved = await repo.upsertRestaurant(next);
  const log: DataChange[] = changed.map((f) => ({
    entityType: "restaurant",
    entityId: id,
    changeType: "updated",
    field: f,
    oldValue: current[f],
    newValue: next[f],
    source: "manual",
    detectedAt: now,
    reviewedAt: now,
  }));
  await repo.recordChanges(log);
  return json(saved);
});

/** "Delete" hides the record (keeps history and stops refresh from re-adding it). */
export const DELETE = withAdmin<Ctx>(async (_req, ctx, admin) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  const r = await repo.getRestaurant(id);
  if (!r) return error(404, "Not found");
  await repo.upsertRestaurant({ ...r, status: "hidden", lockedFields: [...new Set([...r.lockedFields, "status"])] });
  await repo.recordChanges([{ entityType: "restaurant", entityId: id, changeType: "updated", field: "status", oldValue: r.status, newValue: "hidden", source: "manual", detectedAt: new Date().toISOString() }]);
  return json({ ok: true, by: admin.by });
});
