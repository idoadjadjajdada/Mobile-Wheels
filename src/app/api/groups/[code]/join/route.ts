import { z } from "zod";
import { error, handleError, json, limited, parseBody } from "@/lib/api";
import { getRepo } from "@/lib/db";

const schema = z.object({ memberId: z.string().uuid(), displayName: z.string().min(1).max(40) });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[code]/join">) {
  const rl = limited(req, "group-join", 20);
  if (rl) return rl;
  const { code } = await ctx.params;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  try {
    const g = await getRepo().joinGroup(code, body.data.memberId, body.data.displayName);
    return g ? json({ ok: true, code: g.code, center: g.center }) : error(404, "Group not found, expired, or full");
  } catch (err) {
    return handleError(err);
  }
}
