import { error, json, parseBody } from "@/lib/api";
import { menuItemInput } from "@/lib/admin-schemas";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";
import type { MenuItem } from "@/lib/types";

/** Create or correct a menu item (chain-wide or location-specific). */
export const POST = withAdmin(async (req, _ctx, admin) => {
  const body = await parseBody(req, menuItemInput);
  if (!body.ok) return body.res;
  const d = body.data;
  const repo = getRepo();
  const now = new Date().toISOString();
  const existing = d.id ? await repo.getMenuItem(d.id) : null;
  const manual = { source: "manual" as const, verification: "verified" as const, verifiedAt: now, verifiedBy: admin.by };
  const price = (p: typeof d.price): MenuItem["price"] => ({
    ...p,
    currency: "USD",
    source: "manual",
    verifiedAt: p.status === "verified" ? now : undefined,
  });
  const item: MenuItem = {
    id: d.id ?? "",
    chainId: d.restaurantId ? undefined : d.chainId,
    restaurantId: d.restaurantId,
    name: d.name,
    description: d.description,
    category: d.category,
    ingredients: d.ingredients.map((i) => i.toLowerCase()),
    price: price(d.price),
    comboPrice: d.comboPrice ? price(d.comboPrice) : undefined,
    isCombo: d.isCombo,
    portion: d.portion,
    nutrition: d.calories != null ? { calories: d.calories, provenance: manual } : existing?.nutrition,
    allergens: d.allergens ? { contains: d.allergens.contains, provenance: d.allergens.verified ? manual : { ...manual, verification: "reported" } } : undefined,
    dietary: d.dietary,
    image: d.image,
    orderPath: d.orderPath || undefined,
    available: d.available,
    provenance: manual,
  };
  const saved = await repo.upsertMenuItem(item);
  await repo.recordChanges([
    { entityType: "menu_item", entityId: saved.id, changeType: existing ? "updated" : "created", oldValue: existing ?? undefined, newValue: { name: saved.name, price: saved.price }, source: "manual", detectedAt: now, reviewedAt: now },
  ]);
  return json(saved);
});

export const DELETE = withAdmin(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error(400, "id required");
  await getRepo().deleteMenuItem(id);
  return json({ ok: true });
});
