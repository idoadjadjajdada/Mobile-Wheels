import { z } from "zod";
import { error, json, limited, parseBody } from "@/lib/api";
import { passwordLogin } from "@/lib/auth/admin";

export async function POST(req: Request) {
  const rl = limited(req, "admin-login", 8, 5 * 60_000);
  if (rl) return rl;
  const body = await parseBody(req, z.object({ password: z.string().min(1).max(200) }));
  if (!body.ok) return body.res;
  return (await passwordLogin(body.data.password)) ? json({ ok: true }) : error(401, "Wrong password");
}
