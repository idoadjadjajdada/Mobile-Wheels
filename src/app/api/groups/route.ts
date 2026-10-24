import { z } from "zod";
import { handleError, json, limited, parseBody } from "@/lib/api";
import { getRepo } from "@/lib/db";
import { latLng } from "@/lib/validation";

const schema = z.object({ name: z.string().min(1).max(60), memberId: z.string().uuid(), displayName: z.string().min(1).max(40), center: latLng.optional() });

export async function POST(req: Request) {
  const rl = limited(req, "groups", 10);
  if (rl) return rl;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  try {
    const g = await getRepo().createGroup(body.data);
    return json({ code: g.code });
  } catch (err) {
    return handleError(err);
  }
}
