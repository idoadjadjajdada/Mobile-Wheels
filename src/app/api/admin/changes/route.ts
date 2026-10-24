import { z } from "zod";
import { json, parseBody } from "@/lib/api";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";

export const GET = withAdmin(async (req) => {
  const unreviewed = new URL(req.url).searchParams.get("all") !== "1";
  return json({ changes: await getRepo().listChanges({ unreviewedOnly: unreviewed, limit: 200 }) });
});

export const POST = withAdmin(async (req) => {
  const body = await parseBody(req, z.object({ ids: z.array(z.number().int()).max(500) }));
  if (!body.ok) return body.res;
  await getRepo().markChangesReviewed(body.data.ids);
  return json({ ok: true });
});
