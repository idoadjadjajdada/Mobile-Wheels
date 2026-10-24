import { json } from "@/lib/api";
import { withAdmin } from "@/lib/auth/with-admin";
import { CHAINS } from "@/lib/catalog/chains";
import { getRepo } from "@/lib/db";
import { allProviderInfo } from "@/lib/providers/registry";

export const GET = withAdmin(async (_req, _ctx, admin) => {
  const repo = getRepo();
  const [all, runs, changes, reports] = await Promise.all([
    repo.queryRestaurants({ limit: 100_000, includeHidden: true }),
    repo.listRuns(10),
    repo.listChanges({ unreviewedOnly: true, limit: 500 }),
    repo.listReports("open"),
  ]);
  const byStatus: Record<string, number> = {};
  for (const r of all.rows) byStatus[r.refreshStatus] = (byStatus[r.refreshStatus] ?? 0) + 1;
  const coverage = CHAINS.map((c) => ({ id: c.id, name: c.name, tier: c.tier, locations: all.rows.filter((r) => r.chainId === c.id).length }));
  return json({
    admin: admin.by,
    store: repo.mode,
    totals: {
      restaurants: all.total,
      chainLocations: all.rows.filter((r) => r.chainId).length,
      independents: all.rows.filter((r) => !r.chainId).length,
      virtual: all.rows.filter((r) => r.kind !== "standard").length,
      manuallyVerified: all.rows.filter((r) => r.provenance.verification === "verified").length,
      byStatus,
    },
    coverage,
    runs,
    unreviewedChanges: changes.length,
    openReports: reports.length,
    providers: allProviderInfo(),
  });
});
