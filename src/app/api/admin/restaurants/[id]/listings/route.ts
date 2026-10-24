import { error, json, parseBody } from "@/lib/api";
import { listingInput } from "@/lib/admin-schemas";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";

type Ctx = RouteContext<"/api/admin/restaurants/[id]/listings">;

/**
 * Record a delivery-platform listing. This describes *presence on the platform*,
 * verified by a person — it does not claim address coverage or live availability.
 */
export const PUT = withAdmin<Ctx>(async (req, ctx, admin) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  if (!(await repo.getRestaurant(id))) return error(404, "Not found");
  const body = await parseBody(req, listingInput);
  if (!body.ok) return body.res;
  const now = new Date().toISOString();
  const saved = await repo.upsertListing({
    id: "",
    restaurantId: id,
    ...body.data,
    storeUrl: body.data.storeUrl || undefined,
    provenance: {
      source: "manual",
      verification: body.data.listingStatus === "verified_listed" || body.data.listingStatus === "not_listed" ? "verified" : "reported",
      verifiedAt: now,
      verifiedBy: admin.by,
    },
  });
  await repo.recordChanges([{ entityType: "delivery_listing", entityId: saved.id, changeType: "updated", newValue: body.data, source: "manual", detectedAt: now, reviewedAt: now }]);
  return json(saved);
});

export const DELETE = withAdmin<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const platform = new URL(req.url).searchParams.get("platform");
  const repo = getRepo();
  const listing = (await repo.listingsFor([id])).get(id)?.find((l) => l.platform === platform);
  if (!listing) return error(404, "No such listing");
  await repo.deleteListing(listing.id);
  return json({ ok: true });
});
