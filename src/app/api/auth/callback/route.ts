import { NextResponse } from "next/server";
import { supabaseAuthConfigured, supabaseServer } from "@/lib/auth/supabase-server";

/** Magic-link code exchange. Only same-origin relative redirects are allowed. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  if (code && supabaseAuthConfigured()) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
