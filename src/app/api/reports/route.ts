import { z } from "zod";
import { handleError, json, limited, parseBody } from "@/lib/api";
import { getRepo } from "@/lib/db";

const schema = z.object({
  restaurantId: z.string().max(100).optional(),
  menuItemId: z.string().max(100).optional(),
  kind: z.enum(["hours", "price", "closed", "delivery", "menu", "other"]),
  message: z.string().max(1000).optional(),
});

/** Users flag wrong info; it lands in the admin review queue. Demo records are ignored. */
export async function POST(req: Request) {
  const rl = limited(req, "reports", 10);
  if (rl) return rl;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  if (body.data.restaurantId?.startsWith("demo-")) return json({ ok: true, ignored: "demo" });
  try {
    await getRepo().addReport(body.data);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
