import "server-only";
import { LocalRepository } from "./local";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase";

const g = globalThis as unknown as { __craveRepo?: Repository };

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Supabase when configured; otherwise the local JSON dev store. */
export function getRepo(): Repository {
  if (!g.__craveRepo) {
    g.__craveRepo = supabaseConfigured()
      ? new SupabaseRepository(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : new LocalRepository();
  }
  return g.__craveRepo;
}

export type { Repository } from "./repository";
