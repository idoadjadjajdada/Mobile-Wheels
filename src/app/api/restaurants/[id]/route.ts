import { z } from "zod";
import { error, handleError, json, limited, parseBody } from "@/lib/api";
import { restaurantDetail } from "@/lib/discovery";
import { latLng, stateSchema } from "@/lib/validation";

const body = z.object({ point: latLng.optional(), state: stateSchema });

export async function POST(req: Request, ctx: RouteContext<"/api/restaurants/[id]">) {
  const rl = limited(req, "restaurant", 90);
  if (rl) return rl;
  const { id } = await ctx.params;
  const parsed = await parseBody(req, body);
  if (!parsed.ok) return parsed.res;
  try {
    const detail = await restaurantDetail(id, parsed.data.point, parsed.data.state);
    return detail ? json(detail) : error(404, "Restaurant not found");
  } catch (err) {
    return handleError(err);
  }
}
