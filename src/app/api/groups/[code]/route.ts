import { error, handleError, json, limited } from "@/lib/api";
import { getRepo } from "@/lib/db";

/**
 * Group state + matches. A "match" is an offering every member liked; we also
 * surface restaurants everyone liked something from.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/groups/[code]">) {
  const rl = limited(req, "group-get", 120);
  if (rl) return rl;
  const { code } = await ctx.params;
  const memberId = new URL(req.url).searchParams.get("member") ?? "";
  try {
    const g = await getRepo().getGroup(code);
    if (!g) return error(404, "Group not found or expired");
    if (!g.members.some((m) => m.memberId === memberId)) return error(403, "Join the group first");
    const ids = g.members.map((m) => m.memberId);
    const likes = g.swipes.filter((s) => s.action !== "pass");
    const byKey = new Map<string, Set<string>>();
    const byRestaurant = new Map<string, Set<string>>();
    for (const s of likes) {
      byKey.set(s.offeringKey, (byKey.get(s.offeringKey) ?? new Set()).add(s.memberId));
      byRestaurant.set(s.restaurantId, (byRestaurant.get(s.restaurantId) ?? new Set()).add(s.memberId));
    }
    const everyone = (set: Set<string>) => ids.length > 1 && ids.every((i) => set.has(i));
    return json({
      code: g.code,
      name: g.name,
      center: g.center,
      expiresAt: g.expiresAt,
      // Display names only — never other members' ids.
      members: g.members.map((m) => ({ displayName: m.displayName, isMe: m.memberId === memberId, swipes: g.swipes.filter((s) => s.memberId === m.memberId).length })),
      matches: [...byKey].filter(([, s]) => everyone(s)).map(([k]) => k),
      restaurantMatches: [...byRestaurant].filter(([, s]) => everyone(s)).map(([k]) => k),
      mySwipes: g.swipes.filter((s) => s.memberId === memberId).map((s) => s.offeringKey),
    });
  } catch (err) {
    return handleError(err);
  }
}
