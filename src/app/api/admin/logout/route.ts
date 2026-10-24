import { json } from "@/lib/api";
import { adminLogout } from "@/lib/auth/admin";

export async function POST() {
  await adminLogout();
  return json({ ok: true });
}
