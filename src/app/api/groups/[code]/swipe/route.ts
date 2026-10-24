import { z } from "zod";
import { error, json, limited, parseBody } from "@/lib/api";
import { getRepo } from "@/lib/db";

const schema = z.object({
  memberId: z.string().uuid(),
  offeringKey: z.string().min(3).max(200),
  restaurantId: z.string().min(1).max(100),
  action: z.enum(["like", "pass", "save"]),
});

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[code]/swipe">) {
  const rl = limited(req, "group-swipe", 240);
  if (rl) return rl;
  const { code } = await ctx.params;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  try {
    await getRepo().groupSwipe(code, body.data);
    return json({ ok: true });
  } catch {
    return error(403, "Not a member of this group");
  }
}
