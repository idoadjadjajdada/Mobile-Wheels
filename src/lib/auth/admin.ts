import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseConfigured } from "../db";
import { supabaseAuthConfigured, supabaseServer } from "./supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin access:
 *  - Supabase mode: signed-in user whose profiles.role = 'admin'.
 *  - Local dev mode: ADMIN_PASSWORD → signed cookie. Without a password the
 *    dashboard is open only when NODE_ENV !== "production".
 */

const COOKIE = "crave_admin";

function sign(secret: string) {
  return createHmac("sha256", secret).update("crave-admin-v1").digest("hex");
}

export type AdminIdentity = { ok: true; by: string; mode: "supabase" | "password" | "dev-open" } | { ok: false; reason: string };

export async function getAdmin(): Promise<AdminIdentity> {
  if (supabaseConfigured() && supabaseAuthConfigured()) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user) return { ok: false, reason: "Sign in with an admin account." };
    const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: profile } = await svc.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (profile?.role !== "admin") return { ok: false, reason: "This account is not an admin." };
    return { ok: true, by: data.user.email ?? data.user.id, mode: "supabase" };
  }
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, reason: "Set ADMIN_PASSWORD (or configure Supabase) to enable the admin dashboard." }
      : { ok: true, by: "local-dev", mode: "dev-open" };
  }
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const expected = sign(pw);
  const ok = value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  return ok ? { ok: true, by: "admin", mode: "password" } : { ok: false, reason: "Enter the admin password." };
}

export async function passwordLogin(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(pw);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, sign(pw), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return true;
}

export async function adminLogout() {
  (await cookies()).delete(COOKIE);
}
