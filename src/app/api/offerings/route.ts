import { keysRequest } from "@/lib/validation";
import { handleError, json, limited, parseBody } from "@/lib/api";
import { offeringsByKeys } from "@/lib/discovery";

/** Resolve specific offerings (shortlist, compare, order handoff) with fresh hours/links. */
export async function POST(req: Request) {
  const rl = limited(req, "offerings", 60);
  if (rl) return rl;
  const body = await parseBody(req, keysRequest);
  if (!body.ok) return body.res;
  try {
    return json({ offerings: await offeringsByKeys(body.data.keys, body.data.point, body.data.state) });
  } catch (err) {
    return handleError(err);
  }
}
