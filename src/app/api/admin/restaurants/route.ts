import { json, parseBody } from "@/lib/api";
import { restaurantInput } from "@/lib/admin-schemas";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";
import type { StoredRestaurant } from "@/lib/db/repository";

export const GET = withAdmin(async (req) => {
  const sp = new URL(req.url).searchParams;
  const res = await getRepo().queryRestaurants({
    q: sp.get("q") ?? undefined,
    chainId: sp.get("chain") ?? undefined,
    refreshStatus: (sp.get("status") as StoredRestaurant["refreshStatus"]) ?? undefined,
    includeHidden: true,
    limit: Math.min(100, Number(sp.get("limit") ?? 50)),
    offset: Number(sp.get("offset") ?? 0),
  });
  return json(res);
});

/** Manually add a restaurant (e.g. an independent missing from OSM). */
export const POST = withAdmin(async (req, _ctx, admin) => {
  const body = await parseBody(req, restaurantInput);
  if (!body.ok) return body.res;
  const d = body.data;
  const now = new Date().toISOString();
  const prov = { source: "manual" as const, verification: "verified" as const, verifiedAt: now, verifiedBy: admin.by };
  const saved = await getRepo().upsertRestaurant({
    id: "",
    marketId: d.marketId,
    chainId: d.chainId ?? undefined,
    name: d.name,
    kind: d.kind,
    hostRestaurantId: d.hostRestaurantId ?? undefined,
    address: d.address,
    location: d.location,
    phone: d.phone,
    website: d.website || undefined,
    cuisine: d.cuisine,
    priceLevel: (d.priceLevel ?? undefined) as StoredRestaurant["priceLevel"],
    hours: {
      general: d.hours?.general ? { ...d.hours.general, provenance: prov } : undefined,
      delivery: d.hours?.delivery ? { ...d.hours.delivery, provenance: prov } : undefined,
      pickup: d.hours?.pickup ? { ...d.hours.pickup, provenance: prov } : undefined,
      kitchenCutoffMinutes: d.hours?.kitchenCutoffMinutes,
    },
    pickup: d.pickup,
    externalIds: {},
    provenance: prov,
    status: d.status,
    isDemo: false,
    updatedAt: now,
    lockedFields: d.lockedFields ?? [],
    refreshStatus: "manual_only",
  });
  await getRepo().recordChanges([{ entityType: "restaurant", entityId: saved.id, changeType: "created", newValue: { name: saved.name }, source: "manual", detectedAt: now }]);
  return json(saved, { status: 201 });
});
