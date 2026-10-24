import "server-only";
import { error } from "../api";
import { getAdmin } from "./admin";

type Handler<C> = (req: Request, ctx: C, admin: { by: string }) => Promise<Response>;

/** Wrap an admin route: rejects unless getAdmin() authorizes the request. */
export function withAdmin<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const admin = await getAdmin();
    if (!admin.ok) return error(401, admin.reason);
    // CSRF: mutating admin requests must be same-origin.
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== new URL(req.url).host) return error(403, "Cross-origin request blocked");
    }
    return handler(req, ctx, admin);
  };
}
