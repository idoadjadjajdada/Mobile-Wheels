import { z } from "zod";
import { json, parseBody } from "@/lib/api";
import { withAdmin } from "@/lib/auth/with-admin";
import { getRepo } from "@/lib/db";

export const GET = withAdmin(async () => json({ reports: await getRepo().listReports() }));

export const PATCH = withAdmin(async (req) => {
  const body = await parseBody(req, z.object({ id: z.string(), status: z.enum(["open", "resolved", "dismissed"]) }));
  if (!body.ok) return body.res;
  await getRepo().setReportStatus(body.data.id, body.data.status);
  return json({ ok: true });
});
