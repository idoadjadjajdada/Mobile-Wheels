import { deckRequest } from "@/lib/validation";
import { handleError, json, limited, parseBody } from "@/lib/api";
import { buildDeck } from "@/lib/discovery";

export async function POST(req: Request) {
  const rl = limited(req, "deck", 60);
  if (rl) return rl;
  const body = await parseBody(req, deckRequest);
  if (!body.ok) return body.res;
  try {
    return json(await buildDeck({ point: body.data.point, state: body.data.state, limit: body.data.limit }));
  } catch (err) {
    return handleError(err);
  }
}
